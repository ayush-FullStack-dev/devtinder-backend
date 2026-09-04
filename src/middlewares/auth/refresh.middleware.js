import sendResponse, { removeCookie } from "../../helpers/sendResponse.js";
import { buildDeviceInfo } from "../../helpers/buildDeviceInfo.js";
import { verifyRefreshToken } from "../../helpers/token.js";
import { setRefreshExpiry } from "../../helpers/helpers.js";
import { getTime } from "../../helpers/time.js";
import { getIpDetails } from "../../helpers/ip.js";
import { getAccessToken, getRefreshToken } from "../../helpers/token.js";

import { findUser } from "../../services/user.service.js";

import { tokenBuilder } from "../../utils/cron.js";
import { getRiskScore, getRiskLevel } from "../../utils/security/riskEngine.js";
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

  deviceInfo.loginContext.mfa = {
    required: false,
    complete: true,
    methodsUsed: "none",
  };

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
      action: "reauth",
      message:
        "Your device fingerprint changed. Please sign in again to verify your identity.",
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

  const isTrusted = riskLevel === "verylow" || riskLevel === "low";

  deviceInfo.loginContext.trust = {
    deviceTrusted: isTrusted,
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

  if (riskLevel === "mid" || riskLevel === "high") {
    req.auth.verify = {
      success: false,
      action: "reauth",
      message:
        "Suspicious activity detected. Please sign in again to verify your identity.",
    };

    return next();
  }

  return next();
};

export const handleRefreshReauth = async (req, res, next) => {
  const { verify } = req.auth;

  if (verify?.action !== "reauth") return next();

  return removeCookie(res, 401, {
    message: verify?.message || "Please sign in again to verify your identity.",
    action: "reauth",
  });
};

export const rotateRefreshToken = async (req, res, next) => {
  const { token, user, tokenIndex, deviceInfo, verify } = req.auth;

  if (verify?.success === false) return next();

  if (tokenIndex === undefined || tokenIndex === -1) {
    return removeCookie(res, 401, {
      message: "Session is no longer valid. Please sign in again.",
      action: "logout",
    });
  }

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
