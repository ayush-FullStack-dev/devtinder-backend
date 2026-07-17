import crypto from "crypto";

import { getMaskMail } from "./mail.js";
import {
  cleanupLogin,
  setSession,
  getSession,
} from "../services/session.service.js";

export const setTwoFa = async (ctxId, userInfo, methods) => {
  const twoFaCtxId = crypto.randomBytes(16).toString("hex");

  userInfo.ctxId = twoFaCtxId;
  userInfo.token = twoFaCtxId;
  userInfo.loginContext.mfa = {
    required: true,
    complete: false,
  };

  if (ctxId) {
    await cleanupLogin(ctxId);
  }

  await setSession(
    {
      verified: true,
      risk: userInfo.loginContext.trust.sessionLevel,
    },
    twoFaCtxId,
    "2fa:data",
  );

  return {
    info: userInfo,
    ctxId: twoFaCtxId,
    response: {
      message: "2fa required you need to verify-2fa step",
      allowedMethod: methods,
    },
  };
};

export const setOtpMail = async (ctxId, method) => {
  const hashedToken = crypto.createHash("sha256").update(ctxId).digest("hex");
  const getData = await getSession(`otp:email:${hashedToken}`);

  if (!getData) {
    const allowedEmail = [];
    const rawMail = [];

    for (const email in method.emails) {
      if (!method.emails[email]?.verified) {
        continue;
      }
      allowedEmail.push(getMaskMail(method.emails[email].value));
      rawMail.push(method.emails[email].value);
    }
    await setSession(
      {
        verified: true,
        allowedEmail: rawMail,
      },
      hashedToken,
      "otp:email",
      "EX",
      600,
    );
    return {
      message: "Select an email address to receive the verification code.",
      allowedEmail,
      next: "submit_email",
    };
  }

  return {
    success: true,
    hashedToken,
    ...getData,
  };
};
