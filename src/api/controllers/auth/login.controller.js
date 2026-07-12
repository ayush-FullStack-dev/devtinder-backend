import sendResponse, { setCtxId } from "../../../helpers/sendResponse.js";
import crypto from "crypto";

import { cookieOption, accessTokenCookieOption, refreshTokenCookieOption, trustedSessionCookieOption, shortLivedCookieOption } from "../../../constants/auth.constant.js";

import { findUser, updateUser } from "../../../services/user.service.js";
import {
  createAuthEvent,
  findAuthEvent,
} from "../../../services/authEvent.service.js";
import { setSession, cleanupLogin } from "../../../services/session.service.js";

import { signToken } from "../../../helpers/jwt.js";
import { sendSuspiciousAlert } from "../../../helpers/mail.js";
import { getNoSaltHash } from "../../../helpers/hash.js";
import { buildAuthInfo } from "../../../helpers/authEvent.js";
import { getAccessToken, getRefreshToken } from "../../../helpers/token.js";
import { collectOnMethod } from "../../../helpers/helpers.js";
import { setTwoFa } from "../../../helpers/twoFa.js";

import { tokenBuilder } from "../../../utils/cron.js";
import { fingerprintBuilder } from "../../../utils/fingerprint.js";
import {
  calculateLoginRisk,
  sendSecurityUpgrade,
  resolveRiskLevel,
  buildLoginDecisionResponse,
} from "../../../utils/security/loginRisk.js";
import {
  getRiskScore,
  getRiskLevel,
  getTrustedScore,
} from "../../../utils/security/riskEngine.js";

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

  const primaryMethod = {
    verylow: "password",
    low: "passkey",
    mid: "passkey",
    high: "security_code",
  };

  const allowedMethod = [
    "passkey",
    "password",
    "security_code",
    "session_approval",
    "trusted_session",
  ];

  const methods = collectOnMethod(user.twoFA.twoFAMethods);

  if (
    verify?.success === undefined &&
    !allowedMethod.includes(verify?.method)
  ) {
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

  const userInfo = {
    ...deviceInfo,
    loginContext: {
      primary: {
        method: verify?.method,
      },
      mfa: {
        required: false,
        complete: true,
        methodsUsed: "none",
      },
      trust: {
        deviceTrusted: true,
        sessionLevel: info.risk,
      },
    },
  };

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

    if (user.twoFA.token?.length > 10) {
      user.twoFA.token.shift();
    }

    await updateUser(
      user._id,
      {
        "twoFA.tokenInfo": user.twoFA.tokenInfo,
      },
      {
        id: true,
      },
    );

    return res
      .status(401)
      .clearCookie("login_ctx", cookieOption)
      .cookie("twoFA_ctx", data.ctxId, shortLivedCookieOption)
      .json(data.response);
  }

  const accessToken = getAccessToken(user);
  const trustedSession = signToken({
    sub: user._id, // user identity
    did: deviceInfo.deviceId, // trusted device
  });

  const refreshToken = getRefreshToken(
    {
      _id: user._id,
    },
    refreshExpiry.jwt,
  );

  userInfo.fingerprint = fingerprintBuilder(userInfo);
  userInfo.token = refreshToken;

  user.refreshToken.push(tokenBuilder(userInfo));

  if (user.refreshToken.length > process.env.ALLOWED_TOKEN) {
    user.refreshToken.shift();
  }

  const lastInfos = await findAuthEvent(
    {
      userId: user._id,
      eventType: "login",
      success: true,
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    {
      many: true,
    },
    { createdAt: -1 },
  );

  const trustInfo = await getTrustedScore(userInfo, lastInfos);

  const trustedDevices = user.trustedDevices || [];

  if (trustInfo.trusted) {
    const deviceIdHash = getNoSaltHash(deviceInfo.deviceId);
    const alreadyTrust = trustedDevices?.some(
      (k) => k.deviceIdHash !== deviceIdHash,
    );

    if (alreadyTrust) {
      trustedDevices.push({
        deviceIdHash,
        name: deviceInfo.deviceName,
        country: deviceInfo.country,
        model: deviceInfo.model,
        location: deviceInfo.location,
        trustScore: trustInfo.score,
      });
    }
  }

  const updatedUser = await updateUser(
    user._id,
    {
      refreshToken: user.refreshToken,
      trustedDevices,
    },
    {
      id: true,
    },
  );

  await createAuthEvent(
    await buildAuthInfo(deviceInfo, verify, {
      _id: user._id,
      eventType: "login",
      mfaUsed: "none",
      success: true,
      trusted: trustInfo.score >= 70,
      risk: info.risk,
    }),
  );


  res
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
