import crypto from "crypto";

import ApiError from "../../../helpers/ApiError.js";
import redis from "../../../config/redis.js";
import sendResponse, { clearCtxId } from "../../../helpers/sendResponse.js";

import { cookieOption, accessTokenCookieOption, refreshTokenCookieOption, trustedSessionCookieOption } from "../../../constants/auth.constant.js";
import { buildAuthInfo } from "../../../helpers/authEvent.js";
import { createAuthEvent } from "../../../services/authEvent.service.js";
import {
    sendOtp,
    sendSuspiciousAlert,
    sendLoginAlert
} from "../../../helpers/mail.js";
import { setOtpMail } from "../../../helpers/twoFa.js";

import { findUser, updateUser } from "../../../services/user.service.js";
import {
    setDeviceTrusted,
    isDeviceTrusted
} from "../../../services/auth.service.js";
import {
    setSession,
    getSession,
    getOtpSetOtp,
    cleanup2fa
} from "../../../services/session.service.js";

import { fingerprintBuilder } from "../../../utils/fingerprint.js";
import { issueTokens } from "../../../utils/issueTokens.js";

export const resendOtpHandler = async (req, res) => {
    const { email, ip, country, time } = req.auth;
    const ctxId = req.signedCookies.twoFA_ctx;

    const user = await findUser({
        email
    });

    if (!user) {
        throw new ApiError("UnauthorizedError", "Invalid credentials!", 401);
    }

    let isValid = await getSession(`2fa:session:${ctxId}`);

    if (!isValid.start) {
        return sendResponse(res, 401, {
            message: "2fa session not found first hit /start 2fa route"
        });
    }

    if (isValid.method !== "email") {
        return sendResponse(res, 401, {
            message: "otp is only allowed for email method"
        });
    }

    const emailAllowed = user.twoFA.twoFAMethods.email.enabled;

    if (!emailAllowed) {
        return sendResponse(res, 401, {
            message:
                "User is not allowed to login this account using email method"
        });
    }

    const deviceInfo = {
        browser: req.body.browser,
        os: req.body.os,
        ip,
        country,
        time
    };

    const otp = await getOtpSetOtp(ctxId);
    await sendOtp(email, otp, deviceInfo);
    return sendResponse(res, 200, {
        message: "Otp resend Succesfull",
        route: "/auth/verify-2fa/confirm"
    });
};

export const startTwoFAHandler = async (req, res) => {
    const { loginMethod, email, password, ip } = req.auth;

    const ctxId = req.signedCookies.twoFA_ctx;
    const deviceInfo = {
        ...req.auth.deviceInfo,
        ip
    };

    const fingerprint = fingerprintBuilder(req.auth.deviceInfo);

    const user = await findUser({
        email
    });

    if (!user) {
        return clearCtxId(res, 401, "User Not Found", "twoFA_ctx");
    }

    let isValid = await getSession(`2fa:data:${ctxId}`);

    if (isValid?.risk === "veryhigh") {
        sendSuspiciousAlert(user.email, deviceInfo);
    }

    if (isValid?.risk === "veryhigh" && loginMethod === "BACKUPCODE") {
        return clearCtxId(
            res,
            401,
            "Backup code not allowed for high risk",
            "twoFA_ctx"
        );
    }

    if (!isValid?.verified) {
        return clearCtxId(
            res,
            401,
            {
                message: "2FA session expired or invalid. Please login again.",
                route: "/auth/login"
            },
            "twoFA_ctx"
        );
    }

    await setSession(deviceInfo, ctxId, "device:info");
    await setSession(fingerprint, ctxId, "2fa:fp:start");

    const method = user.twoFA.twoFAMethods;

    if (loginMethod === "EMAIL" && method.email.enabled) {
        let message = "Trusted device detected. Completing secure sign-in…";
        let requireCode = false;
        
        const deviceTrust = await isDeviceTrusted({
            ctxId,
            trustedId: req.signedCookies.trustedDeviceId,
            user,
            fingerprint
        });

        if (!deviceTrust?.success) {
            const info = await setOtpMail(ctxId, method.email);

            if (!info?.success) {
                return sendResponse(res, 200, info);
            }

            if (!info.allowedEmail?.includes(req.body?.mail)) {
                return sendResponse(
                    res,
                    401,
                    "Selected email is not allowed for this verification."
                );
            }

            const otp = await getOtpSetOtp(info.hashedToken);
            const otpInfo = sendOtp(req.body?.mail, otp, deviceInfo);
            message = "Otp send Succesfull";
            requireCode = true;
        }

        await setSession(
            {
                start: true,
                method: "EMAIL",
                email: req.body?.otpMail || false
            },
            ctxId
        );

        return sendResponse(res, 200, {
            message,
            route: "/auth/verify-2fa/confirm",
            requireCode
        });
    }

    if (loginMethod === "TOTP" && method.totp.enabled) {
        await setSession(
            {
                start: true,
                method: "TOTP"
            },
            ctxId
        );
        return sendResponse(res, 200, {
            message: "enter totp code",
            route: "/auth/verify-2fa/confirm",
            requireCode: true
        });
    }

    if (loginMethod === "BACKUPCODE" && method.backupCodes.enabled) {
        await setSession(
            {
                start: true,
                method: "BACKUPCODE"
            },
            ctxId
        );
        return sendResponse(res, 200, {
            message: "enter backup code",
            route: "/auth/verify-2fa/confirm",
            requireCode: true
        });
    }

    await setSession(
        {
            start: false,
            method: "none"
        },
        ctxId
    );
    return clearCtxId(res, 401, "Invalid 2fa login method", "twoFA_ctx");
};

export const verifyTwoFAHandler = async (req, res) => {
    const { user, verify, userInfo, refreshExpiry, info, deviceInfo, ctxId } = req.auth;

    const tokenInfo = user.twoFA.tokenInfo.find(k => k.ctxId === ctxId);

    if (info.risk === "high" && !verify?.success) {
        sendSuspiciousAlert(user.email, deviceInfo);
    }

    if (!verify?.success) {
        await cleanup2fa(ctxId);
        await createAuthEvent(
            await buildAuthInfo(userInfo, verify, {
                _id: user._id,
                eventType: "login",
                mfaUsed: verify?.method,
                loginMethod: tokenInfo?.loginContext?.primary?.method,
                success: false,
                action: "login_failed",
                risk: info.risk,
            })
        );
        return clearCtxId(res, 401, verify?.message, "twoFA_ctx");
    }

    await cleanup2fa(ctxId);

    const checkDeviceTrusted = await setDeviceTrusted({
        trustDevice: req.body.trustDevice,
        rememberDevice: req.body.rememberDevice,
        ctxId,
        userInfo,
    });

    // patch mfa context onto tokenInfo before issueTokens uses it
    if (tokenInfo) {
        tokenInfo.loginContext.mfa = {
            required: true,
            complete: true,
            methodsUsed: verify.method,
        };
    }

    const { accessToken, refreshToken, trustedSession, updatedUser } = await issueTokens({
        user,
        deviceInfo,
        verify: { ...verify, mfaUsed: verify.method, loginMethod: tokenInfo?.loginContext?.primary?.method },
        info,
        refreshExpiry,
        userInfo: tokenInfo || userInfo,
    });

    await updateUser(
        user._id,
        { "twoFA.tokenInfo": user.twoFA.tokenInfo.filter(k => k.ctxId !== ctxId) },
        { id: true },
    );

    sendLoginAlert(user.email, {
        name: user.name,
        ...deviceInfo,
        deviceName: userInfo.deviceName,
    });

    return res.status(200)
        .clearCookie("twoFA_ctx", cookieOption)
        .cookie("accessToken", accessToken, accessTokenCookieOption)
        .cookie("refreshToken", refreshToken, refreshTokenCookieOption(refreshExpiry.ms))
        .cookie("trustedDeviceId", checkDeviceTrusted?.trustedId, trustedSessionCookieOption)
        .json({
            success: true,
            message: "User login successfully",
            data: {
                name: updatedUser.name,
                email: updatedUser.email,
                picture: updatedUser.picture,
            },
        });
};
