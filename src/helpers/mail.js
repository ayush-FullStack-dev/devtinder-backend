import mailer from "nodemailer";

import "../config/config.js";

import verifyAccountTemplate from "../templates/mail/verifyAccount.template.js";
import verifyOtpTemplete from "../templates/mail/verifyOtp.templete.js";
import suspiciousAlertTemplete from "../templates/mail/suspiciousAlert.templete.js";
import newLoginAlertTemplete from "../templates/mail/newLoginAlert.templete.js";

import { logoutAllTemplate } from "../templates/mail/logoutAlert.templete.js";

import { maskIp } from "../helpers/ip.js";
import { getAsterisk } from "../helpers/helpers.js";
import {
  passwordChangedAlertTemplate,
  forgotPasswordTemplate,
  resetPasswordAlertTemplate,
} from "../templates/mail/password.template.js";
import { Resend } from "resend";
import nodemailer from "nodemailer";

const resend = new Resend(process.env.RESEND_API_KEY);

export const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.MAIL,
    pass: process.env.MAIL_PASS,
  },
});

export const sendMail = async (mail, subject, html) => {
  try {
    const { data, error } = await resend.emails.send({
      from: `"DevTinder" <no-reply@${process.env.DOMAIN}>`,
      to: mail,
      subject,
      html,
    });

    if (error) {
      throw new Error(error.message || "Resend failed");
    }

    return {
      success: true,
      provider: "resend",
      message: "Mail sent successfully!",
      data,
    };
  } catch (resendError) {
    try {
      const info = await transporter.sendMail({
        from: `"DevTinder" <${process.env.MAIL}>`,
        to: mail,
        subject,
        html,
      });

      return {
        success: true,
        provider: "nodemailer",
        message: "Mail sent successfully using fallback SMTP!",
        data: info,
      };
    } catch (smtpError) {
      return {
        success: false,
        provider: "none",
        message: "Failed to send email",
        error: smtpError,
      };
    }
  }
};

export const sendVerifyLink = async (userMail, verificationToken) => {
  const verifyLink = `${process.extra.DOMAIN_LINK}/auth/verify?token=${verificationToken}`;
  const mailInfo = await sendMail(
    userMail,
    "Verify Your Email Address",
    verifyAccountTemplate(verifyLink),
  );
  
  return mailInfo;
};

export const sendOtp = async (userMail, otp, deviceInfo) => {
  const mailInfo = await sendMail(
    userMail,
    "“DevTinder: Confirm Your Sign-In",
    verifyOtpTemplete(
      otp,
      deviceInfo.browser,
      deviceInfo.os,
      deviceInfo.ip,
      deviceInfo.country,
      deviceInfo.fullTime.readable,
    ),
  );
  return mailInfo;
};

export const sendSuspiciousAlert = async (userMail, deviceInfo) => {
  const link = `${process.extra.DOMAIN_LINK}/account/activity/`;
  for (const info in deviceInfo) {
    deviceInfo[info] = deviceInfo[info] || "UNKNOWN";
  }

  const mailInfo = await sendMail(
    userMail,
    "“DevTinder: unusual activity Review you account!",
    suspiciousAlertTemplete(
      userMail,
      deviceInfo.ip,
      deviceInfo.browser,
      deviceInfo.os,
      deviceInfo.country,
      link,
      deviceInfo.fullTime.readable,
    ),
  );
  return mailInfo;
};

export const sendLoginAlert = async (userMail, userInfo) => {
  const link = `${process.extra.DOMAIN_LINK}/account/resetPassword/`;

  for (const info in userInfo) {
    userInfo[info] = userInfo[info] || "UNKNOWN";
  }

  const mailInfo = await sendMail(
    userMail,
    `New login to DevTinder from ${userInfo.deviceName}`,
    newLoginAlertTemplete(
      userMail,
      userInfo.name,
      userInfo.ip,
      userInfo.location,
      userInfo.deviceModel,
      userInfo.browser,
      userInfo.fullTime.readable,
      link,
    ),
  );
  return mailInfo;
};

export const sendLogoutAllAlert = async (userMail, userInfo) => {
  const link = `${process.extra.DOMAIN_LINK}/account/resetPassword/`;

  for (const info in userInfo) {
    userInfo[info] = userInfo[info] || "UNKNOWN";
  }

  const mailInfo = await sendMail(
    userMail,
    `Signed out from all devices`,
    logoutAllTemplate(
      userInfo.name,
      userInfo.fullTime.readable,
      userInfo.reason,
      userInfo.ip,
      userInfo.deviceModel,
      userInfo.browser,
      userInfo.os,
      userInfo.location,
      link,
    ),
  );
  return mailInfo;
};

export const sendPasswordChangedAlert = async (userMail, userInfo) => {
  const link = `${process.extra.DOMAIN_LINK}/account/resetPassword/`;

  for (const info in userInfo) {
    userInfo[info] = userInfo[info] || "UNKNOWN";
  }

  const mailInfo = await sendMail(
    userMail,
    `Your DevTinder password was changed`,
    passwordChangedAlertTemplate(
      userInfo.name,
      userInfo.deviceName,
      userInfo.location,
      userInfo.fullTime.readable,
      link,
    ),
  );

  return mailInfo;
};

export const sendforgotPasswordReq = async (user, link) => {
  const mailInfo = await sendMail(
    user.email,
    `Reset your DevTinder password`,
    forgotPasswordTemplate(user.name, link),
  );

  return mailInfo;
};

export const sendPasswordResetAlert = async (userMail, userInfo, name) => {
  for (const info in userInfo) {
    userInfo[info] = userInfo[info] || "UNKNOWN";
  }

  const mailInfo = await sendMail(
    userMail,
    `Your password has been reset successfully`,
    resetPasswordAlertTemplate(
      userInfo.name || name,
      userInfo.deviceModel,
      `${userInfo.browser} ${userInfo.browserVersion}`,
      `${userInfo.os} ${userInfo.osVersion}`,
      userInfo.location,
      maskIp(userInfo.ip),
      userInfo.fullTime.readable,
    ),
  );

  return mailInfo;
};

export const getMaskMail = (mail) => {
  const username = mail.split("@");

  if (username[0].length === 1) {
    return `*@${username[1]}`;
  }

  if (username[0].length === 2) {
    const maskMail = username[0].split("");
    return `${maskMail[0]}*@${username[1]}`;
  }

  if (username[0].length <= 4) {
    const maskMail = username[0].split("");
    const length = maskMail.length;
    const asterisk = getAsterisk(maskMail, [length - 1]);
    return `${maskMail[0]}${asterisk}${maskMail[maskMail.length - 1]}@${
      username[1]
    }`;
  }

  if (username[0].length <= 6) {
    const maskMail = username[0].split("");
    const length = maskMail.length;
    const asterisk = getAsterisk(maskMail, [length - 1, length - 2]);
    return `${maskMail[0]}${asterisk}${maskMail[maskMail.length - 2]}${
      maskMail[maskMail.length - 1]
    }@${username[1]}`;
  }

  {
    const maskMail = username[0].split("");
    const length = maskMail.length;
    const asterisk = getAsterisk(maskMail, [
      length - 1,
      length - 2,
      length - 3,
    ]);
    return `${maskMail[0]}${asterisk}${maskMail[maskMail.length - 3]}${
      maskMail[maskMail.length - 2]
    }${maskMail[maskMail.length - 1]}@${username[1]}`;
  }
};
