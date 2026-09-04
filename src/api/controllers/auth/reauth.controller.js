import crypto from "crypto";

import sendResponse, { setCtxId } from "../../../helpers/sendResponse.js";

import {
  cookieOption,
  accessTokenCookieOption,
  refreshTokenCookieOption,
  trustedSessionCookieOption,
} from "../../../constants/auth.constant.js";

import { createAuthEvent } from "../../../services/authEvent.service.js";
import {
  setSession,
  cleanupReauth,
} from "../../../services/session.service.js";

import { buildAuthInfo } from "../../../helpers/authEvent.js";
import { collectOnMethod } from "../../../helpers/helpers.js";
import { issueTokens } from "../../../utils/issueTokens.js";

import { buildDeviceInfo } from "../../../helpers/buildDeviceInfo.js";
import { getIpDetails } from "../../../helpers/ip.js";
import { verifyRefreshToken } from "../../../helpers/token.js";
import { findUser } from "../../../services/user.service.js";
import {
  compareFingerprint,
  fingerprintBuilder,
} from "../../../utils/fingerprint.js";
import {
  getRiskScore,
  getRiskLevel,
} from "../../../utils/security/riskEngine.js";
import { getTime } from "../../../helpers/time.js";
import { removeCookie } from "../../../helpers/sendResponse.js";

const buildReauthUserInfo = (deviceInfo, verify, riskLevel) => ({
  ...deviceInfo,
  loginContext: {
    primary: { method: verify?.method },
    mfa: { required: false, complete: true, methodsUsed: "none" },
    trust: { deviceTrusted: true, sessionLevel: riskLevel },
  },
});

export const reauthIdentifyHandler = async (req, res) => {
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

  const ctxId = crypto.randomBytes(16).toString("hex");

  await setSession(deviceInfo, ctxId, "reauth:info");
  await setSession(
    {
      success: true,
      purpose: "reauth",
      allowedMethod: [
        "passkey",
        "password",
        "session_approval",
        "security_code",
      ],
      risk: riskLevel,
      userId: user._id,
    },
    ctxId,
    "reauth:ctx",
  );

  return setCtxId(
    res,
    200,
    {
      success: true,
      action: "reauth",
      allowedMethod: [
        "passkey",
        "password",
        "session_approval",
        "security_code",
      ],
      primaryMethod: "passkey",
      methods,
      risk: riskLevel,
    },
    ctxId,
    "reauth_ctx",
  );
};

export const verifyReauthHandler = async (req, res) => {
  const { user, verify, deviceInfo, info, ctxId, refreshExpiry } = req.auth;

  const allowedMethod = info?.allowedMethod || [];

  if (
    verify?.success === undefined &&
    !allowedMethod.includes(verify?.method)
  ) {
    return sendResponse(res, 401, {
      message: "No valid verification method provided.",
      code: "METHOD_NOT_FOUND",
      methods: allowedMethod,
      primaryMethod: allowedMethod[0],
    });
  }

  if (!verify?.success) {
    await createAuthEvent(
      await buildAuthInfo(deviceInfo, verify, {
        _id: user._id,
        eventType: "reauth",
        action: "reauth_failed",
        mfaUsed: "none",
        success: false,
        risk: info?.risk,
      }),
    );

    await cleanupReauth(ctxId);

    return sendResponse(
      res,
      401,
      verify?.message || "Re-authentication failed.",
    );
  }

  const userInfo = buildReauthUserInfo(deviceInfo, verify, info?.risk);

  const { accessToken, refreshToken, trustedSession, updatedUser } =
    await issueTokens({
      user,
      deviceInfo,
      verify,
      info,
      refreshExpiry,
      userInfo,
      skipLoginEvent: true,
    });

  await createAuthEvent(
    await buildAuthInfo(deviceInfo, verify, {
      _id: user._id,
      eventType: "reauth",
      action: "reauth_success",
      mfaUsed: verify?.method === "passkey" ? "passkey" : "none",
      success: true,
      risk: info?.risk,
    }),
  );

  await cleanupReauth(ctxId);

  if (req.auth.type === "server") {
    return {
      success: true,
      accessToken,
      refreshToken,
      trustedSession,
      user: {
        name: updatedUser.name,
        email: updatedUser.email,
        picture: updatedUser.picture,
      },
    };
  }

  return res
    .status(200)
    .clearCookie("reauth_ctx", cookieOption)
    .clearCookie("approvalId", cookieOption)
    .cookie("accessToken", accessToken, accessTokenCookieOption)
    .cookie(
      "refreshToken",
      refreshToken,
      refreshTokenCookieOption(refreshExpiry.ms),
    )
    .cookie("trustedSession", trustedSession, trustedSessionCookieOption)
    .json({
      success: true,
      code: "REAUTH_SUCCESS",
      message: "Identity verified successfully.",
      data: {
        name: updatedUser.name,
        email: updatedUser.email,
        picture: updatedUser.picture,
      },
    });
};
