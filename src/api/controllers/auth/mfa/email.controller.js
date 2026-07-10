import sendResponse from "../../../../helpers/sendResponse.js";

import { generateHash, verifyHash } from "../../../../helpers/hash.js";
import { sendOtp } from "../../../../helpers/mail.js";

import {
  setSession,
  getSession,
  cleanupMfa,
} from "../../../../services/session.service.js";
import { updateUser } from "../../../../services/user.service.js";
import { createAuthEvent } from "../../../../services/authEvent.service.js";
import { buildAuthInfo } from "../../../../helpers/authEvent.js";

export const activeMailsHandler = async (req, res) => {
  const { user, risk, device, verifyInfo } = req.auth;
  const response = {
    enabled: user.twoFA.twoFAMethods.email.enabled,
    emails: [],
    primary: null,
    createdAt: user.twoFA.twoFAMethods.email.createdAt,
    canAdd: true,
    canChange: true,
    canDisable: true,
  };

  if (user.twoFA.twoFAMethods.email.emails.length > 0) {
    for (const email of user.twoFA.twoFAMethods.email.emails) {
      if (email.primary) {
        response.primary = email.value;
      }
      response.emails.push({
        value: email.value,
        verified: email.verified,
        addedAt: email.addedAt,
        lastUsedAt: email.lastUsedAt,
      });
    }
  }

  await createAuthEvent(
    await buildAuthInfo(device, verifyInfo, {
      _id: user._id,
      eventType: "mfa_manage",
      success: true,
      action: "get_email",
      risk: risk,
    }),
  );

  return sendResponse(res, 200, response);
};

export const addNewMailHandler = async (req, res) => {
  const { user, device, hashedToken } = req.auth;
  let method = user.twoFA.twoFAMethods.email;
  const isMail =
    /^[a-zA-Z0-9._%+-]{1,64}@[a-zA-Z0-9-]{1,63}(\.[a-zA-Z0-9-]{1,63}){1,3}$/.test(
      req.body?.email,
    );
  if (!isMail) {
    return sendResponse(res, 400, "Enter a valid email address");
  }

  const isDuplicateMail = user.twoFA.twoFAMethods.email.emails.find(
    (e) => e.value === req.body?.email,
  );

  if (isDuplicateMail?.verified === false) {
    return sendResponse(res, 401, {
      message: "Email already exists you need to verify.",
      next: "sumbit_otp",
      route: "/auth/mfa/mange/email/verify/",
      request: "post",
    });
  }
  if (isDuplicateMail?.verified) {
    return sendResponse(res, 401, "Email already exists.");
  }

  if (!method.enabled) {
    method = {
      enabled: true,
      primary: req.body?.email,
      emails: [
        {
          primary: true,
          verified: false,
          value: req.body?.email,
          addedAt: new Date(),
        },
      ],
      createdAt: new Date(),
    };
  } else {
    if (method.primary) {
      method.emails.push({
        value: req.body?.email,
        verified: false,
        addedAt: new Date(),
      });
    } else {
      method = {
        enabled: true,
        primary: req.body?.email,
        emails: [...user.twoFA.twoFAMethods.email.emails],
        createdAt: user.twoFA.twoFAMethods.email.createdAt,
      };
      method.emails.push({
        value: req.body?.email,
        verified: false,
        primary: true,
        addedAt: new Date(),
      });
    }
  }

  const otp = crypto.randomInt(100000, 1000000);

  await setSession(
    {
      otp: await generateHash(otp.toString()),
      value: req.body?.email,
      verified: false,
    },
    hashedToken,
    "email:verified",
    "EX",
    180,
  );

  await setSession(
    {
      verified: false,
      value: req.body?.email,
    },
    req.body?.email,
    "verified:email",
  );

  await sendOtp(req.body?.email, otp, device);

  await updateUser(
    {
      _id: user._id,
    },
    {
      "twoFA.twoFAMethods.email": method,
    },
  );

  return sendResponse(res, 200, {
    message: "Email added successfully Please verify to continue.",
    next: "VERIFY_OTP",
    route: "/auth/mfa/mange/email/verify/",
    request: "post",
  });
};

export const verifyMailHandler = async (req, res) => {
  const { user, hashedToken, risk, device, verifyInfo } = req.auth;
  const info = await getSession(`email:verified:${hashedToken}`);

  if (!info) {
    return sendResponse(res, 401, {
      message: "Your verify email session has expired. Please start again.",
      action: "RESTART_VERIFACTION",
    });
  }
  if (!req.body?.email) {
    return sendResponse(res, 400, "Enter a valid email address");
  }
  if (!req.body?.value) {
    return sendResponse(res, 400, "OTP is required");
  }

  const isValidOtp = await verifyHash(req.body?.value, info.otp);

  if (!isValidOtp) {
    return sendResponse(res, 401, "invalid otp try again.");
  }

  const index = user.twoFA.twoFAMethods.email.emails.findIndex(
    (k) => k.value === info?.value,
  );

  if (req.body?.email !== info?.value) {
    return sendResponse(
      res,
      401,
      "This request is prevent email hopping attack!",
    );
  }

  user.twoFA.twoFAMethods.email.emails[index].verified = true;

  await updateUser(
    {
      _id: user._id,
    },
    {
      "twoFA.twoFAMethods.email": user.twoFA.twoFAMethods.email,
    },
  );

  await cleanupMfa(hashedToken, req.body?.email);

  await createAuthEvent(
    await buildAuthInfo(device, verifyInfo, {
      _id: user._id,
      eventType: "mfa_manage",
      success: true,
      action: "added_email",
      risk: risk,
    }),
  );

  return sendResponse(res, 201, "Email verified successfully");
};

export const revokeMailHandler = async (req, res) => {
  const { user, hashedToken, risk, device, verifyInfo } = req.auth;
  const method = user.twoFA.twoFAMethods.email;
  let emailInfo = null;
  if (!method.enabled) {
    return sendResponse(
      res,
      403,
      "email method is not enabled for your account",
    );
  }

  if (!req.body?.email) {
    return sendResponse(res, 400, "Enter a valid email address");
  }

  const index = method.emails.findIndex((k) => k.value === req.body?.email);

  if (index === -1) {
    return sendResponse(res, 401, "Invalid email address");
  }

  if (method.primary === method.emails[index].value) {
    const info = await getSession(`email:verified:${hashedToken}`);

    if (!info) {
      const otp = Math.floor(100000 + Math.random() * 900000);
      await setSession(
        {
          otp: await generateHash(otp.toString()),
          value: req.body?.email,
        },
        hashedToken,
        "email:verified",
        "EX",
        300,
      );
      await setSession(
        {
          verified: false,
          value: req.body?.email,
        },
        req.body?.email,
        "verified:email",
      );
      await sendOtp(req.body?.email, otp, device);

      return sendResponse(res, 202, {
        message: "OTP sent successfully. Please verify to continue.",
        next: "VERIFY_OTP",
        expiresIn: 300,
      });
    }

    if (req.body?.email !== info?.value) {
      return sendResponse(
        res,
        401,
        "This request is prevent email hopping attack!",
      );
    }

    if (!req.body?.value) {
      return sendResponse(res, 400, "OTP is required");
    }

    const isValidOtp = await verifyHash(req.body?.value, info.otp);

    if (!isValidOtp) {
      return sendResponse(res, 401, "invalid otp try again.");
    }
  }

  method.emails.splice(index, 1);
  if (!method.emails?.length) {
    emailInfo = {
      enabled: true,
      primary: null,
      emails: method.emails,
    };

    for (const email of method.emails) {
      if (email.primary) {
        emailInfo.primary = email.value;
      }
    }
  } else {
    emailInfo = {
      enabled: false,
      primary: null,
      emails: [],
    };
  }

  await updateUser(
    {
      _id: user._id,
    },
    {
      "twoFA.twoFAMethods.email": emailInfo,
    },
  );

  await cleanupMfa(hashedToken, req.body?.email);
  await createAuthEvent(
    await buildAuthInfo(device, verifyInfo, {
      _id: user._id,
      eventType: "mfa_manage",
      success: true,
      action: "delete_email",
      risk: risk,
    }),
  );
  return sendResponse(res, 200, "Email removed successfully");
};

export const resendOtpMfaHandler = async (req, res) => {
  const { user, device, hashedToken } = req.auth;
  const info = await getSession(`verified:email:${req.body?.email}`);

  if (!info) {
    return sendResponse(res, 401, {
      message: "Your verify email session has expired. Please start again.",
      action: "RESTART_VERIFACTION",
    });
  }

  const otp = Math.floor(100000 + Math.random() * 900000);

  await setSession(
    {
      otp: await generateHash(otp.toString()),
      value: info?.email,
    },
    hashedToken,
    "email:verified",
    "EX",
    300,
  );
  await sendOtp(info.email, otp, device);

  return sendResponse(res, 202, {
    message: "OTP resend successfully. Please verify to continue.",
    next: "VERIFY_OTP",
    expiresIn: 300,
  });
};
