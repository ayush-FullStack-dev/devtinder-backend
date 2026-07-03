import sendResponse from "../../helpers/sendResponse.js";

import { sendSuspiciousAlert } from "../../helpers/mail.js";
import { getRiskLevel, getRiskScore } from "./riskEngine.js";

import { getPasskey } from "../../helpers/passkey.js";

import { setSession } from "../../services/session.service.js";

export const calculateLoginRisk = async (user, userInfo, time) => {
  let score = 0;
  if (user.refreshToken.length) {
    const lastSession = user.refreshToken[user.refreshToken.length - 1];
    score = await getRiskScore(userInfo, lastSession, {
      time,
    });
  }

  return score;
};

export const resolveRiskLevel = async (score, enabled) => {
  let riskLevel = "low";
  if (enabled) {
    if (score >= 85) {
      riskLevel = "veryhigh";
    } else {
      riskLevel = "mid";
    }
  } else {
    riskLevel = await getRiskLevel(score);
  }

  return riskLevel;
};

export const sendSecurityUpgrade = (user, res, deviceInfo) => {
  sendSuspiciousAlert(user.email, deviceInfo);
  return sendResponse(res, 403, {
    success: false,
    code: "SECURITY_UPGRADE_REQUIRED",
    message:
      "We detected unusual activity. Please secure your account to continue.",
    risk: "veryhigh",
    required: ["2fa"],
    allowedNext: ["enable_2fa", "account_recovery"],
  });
};

export const buildLoginDecisionResponse = async (riskLevel, ctxId, user) => {
  const options = await getPasskey(user);

  if (user.logout?.length && riskLevel === "verylow") {
    const lastLogout = user.logout[user.logout.length - 1];

    if (lastLogout?.logout === "logout-all") {
      await setSession(
        { challenge: options.challenge },
        ctxId,
        "passkey:login",
      );
      return {
        action: "REQUIRED_METHOD",
        risk: riskLevel,
        loginCtx: ctxId,
        allowedMethod: ["passkey", "password"],
        primaryMethod: "passkey",
        passkey: options,
      };
    }
  }

  if (riskLevel === "verylow") {
    return {
      action: "AUTO_LOGIN",
      risk: riskLevel,
      loginCtx: ctxId,
      message: "Signed in automatically",
      primaryMethod: "auto",
      allowedMethod: [
        "passkey",
        "password",
        "session_approval",
        "security_code",
        "trusted_session",
      ],
    };
  }
  if (riskLevel === "low") {
    await setSession({ challenge: options.challenge }, ctxId, "passkey:login");
    return {
      action: "REQUIRED_METHOD",
      risk: riskLevel,
      loginCtx: ctxId,
      allowedMethod: ["passkey", "password"],
      primaryMethod: "passkey",
      passkey: options,
    };
  }
  if (riskLevel === "mid") {
    await setSession({ challenge: options.challenge }, ctxId, "passkey:login");
    return {
      action: "REQUIRED_METHOD",
      risk: riskLevel,
      loginCtx: ctxId,
      allowedMethod: [
        "passkey",
        "password",
        "session_approval",
        "security_code",
      ],
      primaryMethod: "passkey",
      passkey: options,
    };
  }
  if (riskLevel === "high") {
    await setSession({ challenge: options.challenge }, ctxId, "passkey:login");
    return {
      action: "REQUIRED_METHOD",
      risk: riskLevel,
      loginCtx: ctxId,
      primaryMethod: "security_code",
      allowedMethod: [
        "password",
        "security_code",
        "session_approval",
        "passkey",
      ],
      stepUp: ["2fa"],
      passkey: options,
    };
  }

  return {
    action: "REQUIRED_METHOD",
    risk: riskLevel,
    loginCtx: ctxId,
    allowedMethod: ["security_code", "session_approval"],
    primaryMethod: "security_code",
    stepUp: ["2fa"],
  };
};

export const buildVerifyDecisionResponse = async (riskLevel, ctxId, user) => {
  const options = await getPasskey(user);

  if (user.logout?.length && riskLevel === "verylow") {
    const lastLogout = user.logout[user.logout.length - 1];
    if (lastLogout?.logout === "logout-all") {
      await setSession(
        { challenge: options.challenge },
        ctxId,
        "passkey:login",
      );
      return {
        action: "REQUIRED_METHOD",
        risk: riskLevel,
        loginCtx: ctxId,
        allowedMethod: ["passkey", "password"],
        primaryMethod: "passkey",
        passkey: options,
      };
    }
  }

  if (riskLevel === "verylow" || riskLevel === "low") {
    await setSession({ challenge: options.challenge }, ctxId, "passkey:login");
    return {
      action: "REQUIRED_METHOD",
      risk: riskLevel,
      loginCtx: ctxId,
      allowedMethod: ["passkey", "password"],
      passkey: options,
    };
  }
  if (riskLevel === "mid") {
    await setSession({ challenge: options.challenge }, ctxId, "passkey:login");
    return {
      action: "REQUIRED_METHOD",
      risk: riskLevel,
      loginCtx: ctxId,
      allowedMethod: [
        "passkey",
        "password",
        "session_approval",
        "security_code",
      ],
      primaryMethod: "passkey",
      passkey: options,
    };
  }
  if (riskLevel === "high") {
    await setSession({ challenge: options.challenge }, ctxId, "passkey:login");
    return {
      action: "REQUIRED_METHOD",
      risk: riskLevel,
      loginCtx: ctxId,
      primaryMethod: "security_code",
      allowedMethod: [
        "password",
        "security_code",
        "session_approval",
        "passkey",
      ],
      stepUp: ["2fa"],
      passkey: options,
    };
  }

  return {
    action: "REQUIRED_METHOD",
    risk: riskLevel,
    loginCtx: ctxId,
    allowedMethod: ["security_code", "session_approval"],
    primaryMethod: "security_code",
    stepUp: ["2fa"],
  };
};
