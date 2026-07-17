import sendResponse, { removeCookie } from "../../helpers/sendResponse.js";
import { buildDeviceInfo } from "../../helpers/buildDeviceInfo.js";
import { verifyRefreshToken } from "../../helpers/token.js";
import { collectOnMethod, setRefreshExpiry } from "../../helpers/helpers.js";
import { getTime } from "../../helpers/time.js";
import { getIpDetails } from "../../helpers/ip.js";
import { setTwoFa } from "../../helpers/twoFa.js";
import { getAccessToken, getRefreshToken } from "../../helpers/token.js";

import { findUser, updateUser } from "../../services/user.service.js";
import { getSession } from "../../services/session.service.js";

import { tokenBuilder } from "../../utils/cron.js";
import { getRiskScore, getRiskLevel } from "../../utils/security/riskEngine.js";
import {
  sendSessionApproval,
  checkSessionApproval,
} from "../../utils/security/sessionApproveal.js";
import {
  compareFingerprint,
  fingerprintBuilder,
} from "../../utils/fingerprint.js";

export const extractRefreshToken = (req, res, next) => {
  const oldRefreshToken = req.signedCookies?.refreshToken;
  const oldAccessToken = req.signedCookies?.accessToken;

  if (!oldRefreshToken) {
    return sendResponse(res, 401, {
      message: "Session token is missing or corrupted. Please sign in again.",
      action: "logout",
    });
  }

  req.auth = { oldRefreshToken, oldAccessToken };
  next();
};

export const validateRefreshToken = async (req, res, next) => {
  const { oldRefreshToken } = req.auth;

  const decodePayload = verifyRefreshToken(oldRefreshToken);

  if (!decodePayload?.success) {
    return sendResponse(res, 401, {
      message: decodePayload.message,
      action: "logout",
    });
  }

  const user = await findUser({ _id: decodePayload.data._id });

  if (!user) {
    return removeCookie(res, 401, {
      message: "Session is no longer valid. Please sign in again.",
      action: "logout",
    });
  }

  const findedToken = user.refreshToken.find(
    (k) => k?.token === oldRefreshToken,
  );

  if (findedToken?.version !== 1) {
    return removeCookie(res, 401, {
      message: "Your session has expired. Please sign in to continue.",
      action: "logout",
    });
  }

  req.auth.user = user;
  req.auth.token = findedToken;
  return next();
};

export const bindTokenToDevice = async (req, res, next) => {
  const { token, verify, user } = req.auth;

  if (verify?.success !== undefined) return next();

  const deviceInfo = buildDeviceInfo(
    req.headers["user-agent"],
    req.body,
    await getIpDetails(req.realIp),
  );

  deviceInfo.loginContext = token.loginContext;
  deviceInfo.loginContext.mfa = { required: true, complete: false };

  const validFp = await compareFingerprint(deviceInfo, token.fingerprint);
  deviceInfo.fingerprint = fingerprintBuilder(deviceInfo);

  if (token.deviceId !== req.body.deviceId) {
    req.auth.verify = {
      success: false,
      action: "logout-all",
      message:
        "A different device was detected. All sessions have been signed out for your security.",
    };
    return next();
  }

  if (!validFp) {
    req.auth.verify = {
      success: false,
      action: "stepup",
      stepup: "2fa",
      message:
        "Your device fingerprint changed. Please verify your identity to continue.",
    };

    return next();
  }

  req.auth.validFp = validFp;
  req.auth.deviceInfo = deviceInfo;
  req.auth.tokenIndex = user.refreshToken.findIndex(
    (t) => t?.token === token?.token,
  );
  return next();
};

export const reEvaluateRisk = async (req, res, next) => {
  const { deviceInfo, token, verify } = req.auth;

  if (verify?.success !== undefined) return next();

  const time = getTime(req);
  const score = await getRiskScore(deviceInfo, token, {
    time,
    validFp: req.auth.validFp,
  });
  const riskLevel = getRiskLevel(score);

  req.auth.riskLevel = riskLevel;

  deviceInfo.loginContext.trust = {
    deviceTrusted: true,
    sessionLevel: riskLevel,
  };

  if (riskLevel === "veryhigh") {
    req.auth.verify = {
      success: false,
      action: "logout",
      message:
        "Unusual activity was detected on your account. You have been signed out for your security.",
    };
    return next();
  }

  if (riskLevel === "high") {
    req.auth.verify = {
      success: false,
      action: "stepup",
      stepup: "2fa",
      message:
        "Suspicious activity detected. Please complete two-factor authentication to continue.",
    };
    return next();
  }

  if (riskLevel === "mid") {
    req.auth.verify = {
      success: false,
      action: "approval",
      stepup: "2fa",
      message:
        "We need to confirm it's you. Please approve this session from a trusted device.",
    };
    return next();
  }

  return next();
};

export const handleStepUpIfNeeded = async (req, res, next) => {
  const { verify, token, riskLevel, user,deviceInfo , tokenIndex } = req.auth;

  if (verify?.success === undefined || verify?.stepup !== "2fa") return next();

  if (verify?.action === "stepup") {
    const methods = collectOnMethod(user.twoFA.loginMethods);

    const data = await setTwoFa(undefined, token, methods);

    user.refreshToken[tokenIndex] = data.info;

    await updateUser(
      user._id,
      { refreshToken: user.refreshToken },
      { id: true },
    );

    return removeCookie(res, 401, {
      message: "Two-factor authentication is required to continue.",
      action: "stepup",
      stepup: "2fa",
      allowedMethods: data.response.allowedMethod,
    });
  }

  const approval = await getSession(`approval:${req.body.code}`);

  if (!approval) {
    const { approvalId, timeout } = await sendSessionApproval(deviceInfo, user);
    return sendResponse(res, 200, {
      message: "An approval request has been sent to your trusted devices.",
      action: "await_approval",
      approvalId,
      timeout,
    });
  }

  if (approval?.status === "pending") {
    return sendResponse(res, 202, {
      message: "Waiting for approval from your trusted device.",
      action: "await_approval",
    });
  }

  req.auth.verify = checkSessionApproval(approval, { risk: riskLevel });
  return next();
};

export const rotateRefreshToken = async (req, res, next) => {
  const { token, user, tokenIndex, deviceInfo, verify } = req.auth;

  if (verify?.success === false) return next();

  const expiry = setRefreshExpiry(req.body);
  const accessToken = getAccessToken(user);
  const refreshToken = getRefreshToken({ _id: user._id }, expiry.jwt);

  deviceInfo.token = refreshToken;
  deviceInfo.lastActive = new Date();
  user.refreshToken.splice(tokenIndex, 1, tokenBuilder(deviceInfo));
  req.auth.refreshToken = refreshToken;
  req.auth.accessToken = accessToken;
  req.auth.refreshMaxAge = expiry.ms;
  return next();
};
