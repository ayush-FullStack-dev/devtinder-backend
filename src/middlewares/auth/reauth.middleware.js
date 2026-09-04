import sendResponse, { removeCookie } from "../../helpers/sendResponse.js";
import { buildDeviceInfo } from "../../helpers/buildDeviceInfo.js";
import { verifyRefreshToken } from "../../helpers/token.js";
import { getIpDetails } from "../../helpers/ip.js";
import { findUser } from "../../services/user.service.js";
import { compareFingerprint, fingerprintBuilder } from "../../utils/fingerprint.js";
import { getRiskScore, getRiskLevel } from "../../utils/security/riskEngine.js";
import { getTime } from "../../helpers/time.js";

export const isValidReauthSession = async (req, res, next) => {
  const oldRefreshToken = req.signedCookies?.refreshToken;

  if (!oldRefreshToken) {
    return removeCookie(res, 401, {
      message: "Re-authentication requires an active session. Please sign in.",
      action: "logout",
    });
  }

  const decoded = verifyRefreshToken(oldRefreshToken);

  if (!decoded?.success) {
    return removeCookie(res, 401, {
      message: decoded.message,
      action: "logout",
    });
  }

  const user = await findUser({ _id: decoded.data._id });

  if (!user) {
    return removeCookie(res, 401, {
      message: "Session is no longer valid. Please sign in again.",
      action: "logout",
    });
  }

  const token = user.refreshToken.find((k) => k?.token === oldRefreshToken);

  if (token?.version !== 1) {
    return removeCookie(res, 401, {
      message: "Your session has expired. Please sign in to continue.",
      action: "logout",
    });
  }

  const deviceInfo = buildDeviceInfo(
    req.headers["user-agent"],
    req.body,
    await getIpDetails(req.realIp),
  );

  if (token.deviceId !== req.body.deviceId) {
    return removeCookie(res, 401, {
      message:
        "A different device was detected. All sessions have been signed out for your security.",
      action: "logout-all",
    });
  }

  const validFp = await compareFingerprint(deviceInfo, token.fingerprint);

  if (!validFp) {
    return sendResponse(res, 401, {
      message:
        "Your device fingerprint changed. Re-authentication cannot proceed.",
      action: "logout",
    });
  }

  deviceInfo.fingerprint = fingerprintBuilder(deviceInfo);
  deviceInfo.loginContext = token.loginContext;

  const time = getTime(req);
  const score = await getRiskScore(deviceInfo, token, { time, validFp });
  const riskLevel = getRiskLevel(score);

  const tokenIndex = user.refreshToken.findIndex(
    (t) => t?.token === oldRefreshToken,
  );

  req.auth = {
    user,
    token,
    tokenIndex,
    deviceInfo,
    riskLevel,
    oldRefreshToken,
  };

  return next();
};

export const findReauthData = (req, res, next) => {
  const reauthCtxId = req.signedCookies?.reauth_ctx;

  if (!reauthCtxId) {
    return sendResponse(res, 401, {
      message: "Re-authentication session not found. Please start again.",
      action: "RESTART_REAUTH",
    });
  }

  return next();
};
