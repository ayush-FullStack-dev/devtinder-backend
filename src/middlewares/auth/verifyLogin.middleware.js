import crypto from "crypto";

import sendResponse from "../../helpers/sendResponse.js";
import {
  getSession,
  setSession,
  cleanupLogin,
  runRedisLua,
} from "../../services/session.service.js";
import {
  cookieOption,
  methodFailedAttemptLimits,
} from "../../constants/auth.constant.js";
import { findUser, updateUser } from "../../services/user.service.js";
import { securitycodeLua } from "../../constants/redis.contants.js";

import { verifyToken } from "../../helpers/jwt.js";
import { buildDeviceInfo } from "../../helpers/buildDeviceInfo.js";
import { checkValidation, setRefreshExpiry } from "../../helpers/helpers.js";
import { getTime } from "../../helpers/time.js";
import { getIpDetails } from "../../helpers/ip.js";

import { verifyLoginValidator } from "../../validators/auth/verifyLogin.validator.js";

import { getRiskScore } from "../../utils/security/riskEngine.js";
import {
  sendSessionApproval,
  checkSessionApproval,
} from "../../utils/security/sessionApproveal.js";

import { verifyKey } from "../../helpers/passkey.js";

import { verifyHash } from "../../helpers/hash.js";
import { success } from "../../../logs/printLogs.js";

const trackMethodFailure = async (ctxId, method) => {
  const key = `login:attempts:${ctxId}:${method}`;
  const current = await getSession(key);
  const attempts = (current || 0) + 1;
  await setSession(attempts, ctxId, `login:attempts:${method}`, "EX", 600);
  return attempts;
};

const checkMethodLimitExceeded = async (ctxId, method) => {
  const key = `login:attempts:${ctxId}:${method}`;
  const attempts = await getSession(key);
  return attempts > (methodFailedAttemptLimits[method] || 999);
};

export const verifyLoginValidation = async (req, res, next) => {
  const time = getTime(req);
  const ctxId = req.signedCookies?.login_ctx;

  const validate = checkValidation(
    verifyLoginValidator,
    req,
    "validation faild for verify login",
  );

  if (!validate?.success) {
    return sendResponse(res, 400, validate.jsonResponse);
  }

  const getDeviceInfo = buildDeviceInfo(
    req.headers["user-agent"],
    validate.value,
    await getIpDetails(req.realIp),
  );

  const savedDeviceInfo = await getSession(`login:info:${ctxId}`);

  const savedInfo = await getSession(`login:ctx:${ctxId}`);

  if (!savedInfo?.success) {
    return sendResponse(res, 401, {
      message: "Your login session has expired. Please start again.",
      action: "RESTART_LOGIN",
    });
  }

  const user = await findUser({
    _id: savedInfo.userId,
  });

  if (!user) {
    return sendResponse(res, 401, {
      message: "We couldn’t sign you in. Please start again.",
      action: "RESTART_LOGIN",
    });
  }

  const riskScore = await getRiskScore(getDeviceInfo, savedDeviceInfo, {
    time,
  });

  if (riskScore > 0) {
    await cleanupLogin(ctxId);
    return sendResponse(
      res,
      401,
      "We detected unusual activity. This request has been stopped for your security",
    );
  }

  if (savedInfo.risk !== validate.value.risk) {
    await cleanupLogin(ctxId);
    return sendResponse(
      res,
      401,
      "This request is prevent Risk-hopping attack!",
    );
  }

  if (
    savedInfo.allowedMethod &&
    !savedInfo.allowedMethod?.includes(validate.value.method)
  ) {
    await cleanupLogin(ctxId);
    return sendResponse(
      res,
      401,
      "This request is prevent Method-hopping attack!",
    );
  }

  req.auth = {
    refreshExpiry: setRefreshExpiry(validate.value),
    user: user,
    values: validate.value,
    info: savedInfo,
    ctxId,
    deviceInfo: getDeviceInfo,
  };

  return next();
};

export const verifyLoginTrustDevice = async (req, res, next) => {
  const { user, deviceInfo, info, ctxId, values } = req.auth;

  if (values?.method === "trusted_session") {
    const isTrusted = verifyToken(req.signedCookies.trustedSession);

    if (!isTrusted?.success || isTrusted?.data.did !== deviceInfo.deviceId) {
      const attempts = await trackMethodFailure(ctxId, "trusted_session");
      const limitExceeded =
        attempts > methodFailedAttemptLimits.trusted_session;

      if (limitExceeded) {
        await cleanupLogin(ctxId);
        return sendResponse(res, 401, {
          message:
            "Too many failed trusted session attempts. Please start again.",
          action: "RESTART_LOGIN",
        });
      }

      req.auth.verify = {
        success: false,
        method: "trusted_session",
        message: "Device is not trusted. Please use another method.",
      };
      return next();
    }

    req.auth.verify = {
      success: true,
      method: "trusted_session",
    };
    return next();
  }

  if (info.risk !== "verylow") return next();

  if (user.logout?.length) {
    const lastLogout = user.logout[user.logout.length - 1];
    if (lastLogout?.logout === "logout-all") return next();
  }

  if (info?.riskScore <= 5) {
    req.auth.verify = {
      success: true,
      method: "trusted_session",
    };
    return next();
  }

  const isTrusted = verifyToken(req.signedCookies.trustedSession);

  if (isTrusted?.success && isTrusted?.data.did === deviceInfo.deviceId) {
    req.auth.verify = {
      success: true,
      method: "trusted_session",
    };
    return next();
  }

  return next();
};

export const verifyLoginPasskey = async (req, res, next) => {
  const { user, info, ctxId, values, verify } = req.auth;

  if (verify?.success !== undefined) {
    return next();
  }

  if (values.method !== "passkey") {
    return next();
  }

  if (!["low", "mid", "high"].includes(info.risk)) {
    return next();
  }

  const saved = await getSession(`passkey:login:${ctxId}`);

  if (!saved?.challenge) {
    req.auth.verify = {
      success: false,
      method: "passkey",
      message: "Passkey challenge not found. Please try another method.",
    };
    return next();
  }

  const passkeyPayload = values.code;

  const passkeyIndex = user.loginMethods.passkeys.keys.findIndex(
    (k) => k.credentialId === passkeyPayload?.id,
  );

  if (passkeyIndex === -1) {
    req.auth.verify = {
      success: false,
      method: "passkey",
      message: "Invalid passkey credentialId!",
    };
    return next();
  }

  const verification = await verifyKey(
    passkeyPayload,
    saved,
    user.loginMethods.passkeys.keys[passkeyIndex],
  );

  if (!verification?.verified) {
    const attempts = await trackMethodFailure(ctxId, "passkey");
    const limitExceeded = attempts > methodFailedAttemptLimits.passkey;

    if (limitExceeded) {
      await cleanupLogin(ctxId);
      return sendResponse(res, 401, {
        message: "Too many failed passkey attempts. Please start again.",
        action: "RESTART_LOGIN",
      });
    }

    req.auth.verify = {
      success: false,
      method: "passkey",
      stepup: info.risk === "high",
      message: "We couldn't verify this passkey. Please try again.",
    };

    return next();
  }

  user.loginMethods.passkeys.keys[passkeyIndex].counter =
    verification.authenticationInfo.newCounter;
  user.loginMethods.passkeys.keys[passkeyIndex].lastUsedAt = new Date();

  await updateUser(
    {
      _id: user._id,
    },
    {
      "loginMethods.passkeys": user.loginMethods.passkeys,
    },
  );

  req.auth.verify = {
    success: true,
    method: "passkey",
  };

  return next();
};

export const verifyLoginPassword = async (req, res, next) => {
  const { user, info, values, verify, ctxId } = req.auth;

  if (verify?.success !== undefined) {
    return next();
  }

  if (values.method !== "password") {
    return next();
  }

  if (!["low", "mid", "high"].includes(info.risk)) {
    return next();
  }

  if (!values.code) {
    return sendResponse(res, 400, {
      message: "Password is required to verify",
    });
  }

  const isValidPass = await verifyHash(values.code, user.password);

  if (!isValidPass) {
    const attempts = await trackMethodFailure(ctxId, "password");
    const limitExceeded = attempts > methodFailedAttemptLimits.password;

    if (limitExceeded) {
      await cleanupLogin(ctxId);
      return sendResponse(res, 401, {
        message: "Too many failed password attempts. Please start again.",
        action: "RESTART_LOGIN",
      });
    }

    req.auth.verify = {
      success: false,
      method: "password",
      stepup: info.risk === "high",
      message: "Invalid credentials!",
    };
    return next();
  }

  req.auth.verify = {
    success: true,
    stepup: info.risk === "high",
    method: "password",
  };

  return next();
};

export const verifyLoginSessionApproval = async (req, res, next) => {
  const { user, info, values, verify, deviceInfo, ctxId } = req.auth;

  if (verify?.success !== undefined) {
    return next();
  }

  if (values.method !== "session_approval") {
    return next();
  }

  const approval = await getSession(
    `session:approval:${req.signedCookies?.approvalId}`,
  );

  if (!approval) {
    const response = await sendSessionApproval(deviceInfo, user);

    return res
      .status(200)
      .cookie("approvalId", response.approvalId, {
        ...cookieOption,
        maxAge: 2 * 60 * 1000,
      })
      .json({
        success: true,
        code: "SESSION_APPROVAL_REQUESTED",
        timeout: response.timeout,
        message: "Session approval request send successfully",
      });
  }

  if (approval?.status === "pending") {
    return sendResponse(res, 202, {
      code: "WAITING_FOR_APPROVAL",
      message: "Waiting for approval...",
    });
  }


  req.auth.verify = checkSessionApproval(approval, info);

  if (!req.auth.verify?.success) {
    const attempts = await trackMethodFailure(ctxId, "session_approval");
    const limitExceeded = attempts > methodFailedAttemptLimits.session_approval;

    if (limitExceeded) {
      await cleanupLogin(ctxId);
      return sendResponse(res, 401, {
        message: "Session approval rejected. Please start again.",
        action: "RESTART_LOGIN",
      });
    }
  }

  return next();
};

export const verifyLoginSecurityCode = async (req, res, next) => {
  const { user, info, ctxId, values, verify } = req.auth;

  if (verify?.success !== undefined) {
    return next();
  }

  if (values?.method !== "security_code") {
    return next();
  }

  if (!values?.code) {
    return sendResponse(res, 400, {
      message: "security code is required to verify",
    });
  }

  const hashedCode = crypto
    .createHash("sha256")
    .update(values.code)
    .digest("hex");

  const saved = await runRedisLua(
    securitycodeLua,
    `securitycode:login:${hashedCode}`,
  );

  if (!saved?.verified) {
    const attempts = await trackMethodFailure(ctxId, "security_code");
    const limitExceeded = attempts > methodFailedAttemptLimits.security_code;

    if (limitExceeded) {
      await cleanupLogin(ctxId);
      return sendResponse(res, 401, {
        message: "Too many failed security code attempts. Please start again.",
        action: "RESTART_LOGIN",
      });
    }

    req.auth.verify = {
      success: false,
      method: "security_code",
      message: "Your security code is invalid or expired. Try again.",
    };
    return next();
  }

  req.auth.verify = {
    success: true,
    stepup: info.risk === "high" || info.risk === "veryhigh",
    method: "security_code",
  };

  return next();
};

export const verifyLoginFallback = async (req, res, next) => {
  const { info, verify } = req.auth;

  if (verify?.success !== undefined) {
    return next();
  }

  if (info.risk === "verylow") {
    req.auth.verify = {
      success: true,
      method: "fallback",
    };
    return next();
  }

  req.auth.verify = {
    success: false,
    method: "fallback",
    message: "Verification failed. Please use a valid authentication method.",
  };

  return next();
};
