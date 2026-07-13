import sendResponse, { setCtxId } from "../../../helpers/sendResponse.js";
import crypto from "crypto";

import {
  cookieOption,
  accessTokenCookieOption,
  refreshTokenCookieOption,
  trustedSessionCookieOption,
  shortLivedCookieOption,
} from "../../../constants/auth.constant.js";

import { updateUser } from "../../../services/user.service.js";
import { createAuthEvent } from "../../../services/authEvent.service.js";
import { setSession } from "../../../services/session.service.js";

import { buildAuthInfo } from "../../../helpers/authEvent.js";
import { collectOnMethod } from "../../../helpers/helpers.js";
import { setTwoFa } from "../../../helpers/twoFa.js";

import {
  calculateLoginRisk,
  sendSecurityUpgrade,
  resolveRiskLevel,
  buildLoginDecisionResponse,
} from "../../../utils/security/loginRisk.js";
import { issueTokens } from "../../../utils/issueTokens.js";

const buildUserInfo = (deviceInfo, verify, info) => ({
  ...deviceInfo,
  loginContext: {
    primary: { method: verify?.method },
    mfa: { required: false, complete: true, methodsUsed: "none" },
    trust: { deviceTrusted: true, sessionLevel: info.risk },
  },
});

export const loginIdentifyHandler = async (req, res) => {
  const { user, deviceInfo, time } = req.auth;
  const ctxId = crypto.randomBytes(16).toString("hex");
  const score = await calculateLoginRisk(user, deviceInfo, time);
  const riskLevel = await resolveRiskLevel(score, user.twoFA.enabled);

  if (riskLevel === "veryhigh" && !user.twoFA.enabled) {
    return sendSecurityUpgrade(user, res, deviceInfo);
  }

  const response = await buildLoginDecisionResponse(riskLevel, ctxId, user);

  await setSession(deviceInfo, ctxId, "login:info");
  await setSession(
    {
      success: true,
      risk: riskLevel,
      allowedMethod: response.allowedMethod,
      stepUp: response.stepUp,
      riskScore: score,
      userId: user._id,
    },
    ctxId,
    "login:ctx",
  );

  return setCtxId(res, 200, response, ctxId, "login_ctx");
};

export const verifyLoginHandler = async (req, res) => {
  const { refreshExpiry, user, verify, deviceInfo, info, ctxId } = req.auth;

  const allowedMethod = [
    "passkey",
    "password",
    "security_code",
    "session_approval",
    "trusted_session",
  ];

  const primaryMethod = {
    verylow: "password",
    low: "passkey",
    mid: "passkey",
    high: "security_code",
  };

  const methods = collectOnMethod(user.twoFA.twoFAMethods);

  if (verify?.success === undefined && !allowedMethod.includes(verify?.method)) {
    return sendResponse(res, 401, {
      message: "no method provided to verify",
      code: "METHOD_NOT_FOUND",
      methods: allowedMethod,
      primaryMethod: primaryMethod[info.risk],
    });
  }

  if (!verify?.success) {
    await createAuthEvent(
      await buildAuthInfo(deviceInfo, verify, {
        _id: user._id,
        eventType: "login",
        action: "login_failed",
        mfaUsed: "none",
        success: false,
        risk: info.risk,
      }),
    );
    return sendResponse(res, 401, verify?.message || "UnauthorizedError");
  }

  const userInfo = buildUserInfo(deviceInfo, verify, info);

  if (verify?.stepup && !user.twoFA.enabled && verify.method === "password") {
    return sendResponse(res, 403, {
      error: "STEP_UP_REQUIRED",
      message: "Password authentication is not sufficient for this request.",
      action: "TRY_ANOTHER_VERIFICATION_METHOD",
    });
  }

  if (verify?.stepup && user.twoFA.enabled && !["passkey"].includes(verify?.method)) {
    const data = await setTwoFa(ctxId, userInfo, methods);
    user.twoFA.tokenInfo.push(data.info);

    if (user.twoFA.tokenInfo?.length > 10) {
      user.twoFA.tokenInfo.shift();
    }

    await updateUser(user._id, { "twoFA.tokenInfo": user.twoFA.tokenInfo }, { id: true });

    return res
      .status(401)
      .clearCookie("login_ctx", cookieOption)
      .cookie("twoFA_ctx", data.ctxId, shortLivedCookieOption)
      .json(data.response);
  }

  const { accessToken, refreshToken, trustedSession, updatedUser } = await issueTokens({
    user,
    deviceInfo,
    verify,
    info,
    refreshExpiry,
    userInfo,
  });

  // server-side call (e.g. autoLogin after signup)
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
    .clearCookie("login_ctx", cookieOption)
    .cookie("accessToken", accessToken, accessTokenCookieOption)
    .cookie("refreshToken", refreshToken, refreshTokenCookieOption(refreshExpiry.ms))
    .cookie("trustedSession", trustedSession, trustedSessionCookieOption)
    .json({
      success: true,
      code: "LOGIN_SUCCESS",
      message: "User login successfully",
      data: {
        name: updatedUser.name,
        email: updatedUser.email,
        picture: updatedUser.picture,
      },
    });
};
