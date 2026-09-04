import sendResponse from "../../helpers/sendResponse.js";

import { sendSuspiciousAlert } from "../../helpers/mail.js";
import { getRiskLevel, getRiskScore } from "./riskEngine.js";

import { getPasskey } from "../../helpers/passkey.js";

import { setSession } from "../../services/session.service.js";

export const calculateLoginRisk = async (user, userInfo, time) => {
  if (!user.refreshToken.length) {
    return 25;
  }

  const lastSession = user.refreshToken[user.refreshToken.length - 1];
  const score = await getRiskScore(userInfo, lastSession, {
    time,
  });

  return score;
};

export const resolveRiskLevel = (score) => {
  return getRiskLevel(score);
};

export const buildLoginDecisionResponse = async (
  riskLevel,
  ctxId,
  user,
  twoFAEnabled,
) => {
  const options = await getPasskey(user);
  const stepUp =
    twoFAEnabled && ["mid", "high", "veryhigh"].includes(riskLevel)
      ? "2fa"
      : null;

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
      message: "Signed in automatically",
      primaryMethod: "trusted_session",
      passkey: options,
      stepUp,
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
      stepUp,
      allowedMethod: [
        "passkey",
        "password",
        "session_approval",
        "security_code",
        "trusted_session",
      ],
      primaryMethod: "passkey",
      passkey: options,
    };
  }
  if (riskLevel === "mid") {
    await setSession({ challenge: options.challenge }, ctxId, "passkey:login");
    return {
      action: "REQUIRED_METHOD",
      risk: riskLevel,
      allowedMethod: [
        "passkey",
        "password",
        "session_approval",
        "security_code",
        "trusted_session",
      ],
      stepUp,
      primaryMethod: "passkey",
      passkey: options,
    };
  }
  if (riskLevel === "high") {
    await setSession({ challenge: options.challenge }, ctxId, "passkey:login");
    return {
      action: "REQUIRED_METHOD",
      risk: riskLevel,
      stepUp,
      primaryMethod: "security_code",
      allowedMethod: [
        "password",
        "security_code",
        "session_approval",
        "passkey",
      ],
      passkey: options,
    };
  }

  return {
    action: "REQUIRED_METHOD",
    risk: riskLevel,
    stepUp,
    allowedMethod: ["security_code", "session_approval","passkey"],
    primaryMethod: "security_code",
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
      allowedMethod: ["passkey", "password"],
      passkey: options,
    };
  }
  if (riskLevel === "mid") {
    await setSession({ challenge: options.challenge }, ctxId, "passkey:login");
    return {
      action: "REQUIRED_METHOD",
      risk: riskLevel,
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
      primaryMethod: "security_code",
      allowedMethod: [
        "password",
        "security_code",
        "session_approval",
        "passkey",
      ],
      passkey: options,
    };
  }

  return {
    action: "REQUIRED_METHOD",
    risk: riskLevel,
    allowedMethod: ["security_code", "session_approval","passkey"],
    primaryMethod: "security_code",
  };
};
