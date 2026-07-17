import crypto from "crypto";

import sendResponse, { clearCtxId } from "../../../helpers/sendResponse.js";
import redis from "../../../config/redis.js";
import { getLogoutInfo, getInvalidateToken } from "../../../helpers/logout.js";
import { verifyHash, generateHash } from "../../../helpers/hash.js";
import { buildAuthInfo } from "../../../helpers/authEvent.js";
import { getIpDetails } from "../../../helpers/ip.js";
import { buildDeviceInfo } from "../../../helpers/buildDeviceInfo.js";

import { getSession, setSession } from "../../../services/session.service.js";
import { findUser, updateUser } from "../../../services/user.service.js";
import { createAuthEvent } from "../../../services/authEvent.service.js";
import { getRiskScore } from "../../../utils/security/riskEngine.js";

import {
    sendPasswordChangedAlert,
    sendforgotPasswordReq,
    sendPasswordResetAlert
} from "../../../helpers/mail.js";

const isValidPass = async (newPass, oldPassword) => {
    const isValidPass =
        /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/.test(
            newPass
        );

    if (!isValidPass) {
        return "That password doesn’t work. Please follow the password rules and try again.";
    }

    const oldPass = await verifyHash(newPass, oldPassword);

    if (oldPass) {
        return "Your new password must be different from your current password";
    }

    return null;
};

export const changePasswordHandler = async (req, res, next) => {
    const { user, deviceInfo, ctxId, findedCurrent } = req.auth;
    deviceInfo.name = user.name;
    const hashedToken = crypto.createHash("sha256").update(ctxId).digest("hex");
    const getData = await getSession(`change:password:${hashedToken}`);

    if (!getData?.verified) {
        return next();
    }

    const checkIsPass = await isValidPass(req.body.password, user.password);

    if (checkIsPass) {
        return sendResponse(res, 401, checkIsPass);
    }

    const logoutInfo = getLogoutInfo(
        "password_changed",
        "password_change",
        deviceInfo
    );

    user.logout.push(logoutInfo);
    if (user.logout.length >= 15) {
        user.logout.shift();
    }

    await updateUser(
        user._id,
        {
            password: await generateHash(req.body.password),
            refreshToken: getInvalidateToken(user.refreshToken, findedCurrent),
            logout: user.logout
        },
        {
            id: true
        }
    );

    await createAuthEvent(
        await buildAuthInfo(deviceInfo, getData, {
            _id: user._id,
            eventType: "stepup",
            success: true,
            action: "change_password",
            risk: getData.risk
        })
    );

    sendPasswordChangedAlert(user.email, deviceInfo);

    return clearCtxId(res, 200, "Password changed successfully", "verify_ctx");
};

export const forgotPasswordHandler = async (req, res) => {
    const { email } = req.body;
    const isMail =
        /^[a-zA-Z0-9._%+-]{1,64}@[a-zA-Z0-9-]{1,63}(\.[a-zA-Z0-9-]{1,63}){1,3}$/.test(
            email
        );

    if (!isMail) {
        return sendResponse(res, 400, "Enter a valid email address");
    }

    const user = await findUser({
        email
    });

    if (user) {
        const token = crypto
            .randomBytes(Number(process.env.BYTE))
            .toString("hex");
        const link = `${process.env.DOMAIN_LINK}/auth/reset-password/${token}`;

        const hashedToken = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        await setSession(
            {
                userId: user?._id,
                verified: true
            },
            hashedToken,
            "forgot:password",
            "EX",
            600
        );

        await sendforgotPasswordReq(user, link);
    }

    return sendResponse(
        res,
        200,
        "we've sent password reset link successfully"
    );
};

export const resetPasswordValidation = async (req, res) => {
    const rawToken = req.params?.token;
    const device = buildDeviceInfo(
        req.headers["user-agent"],
        req.body,
        await getIpDetails(req.realIp)
    );

    if (rawToken?.length !== Number(process.env.BYTE) * 2) {
        return sendResponse(
            res,
            400,
            "This password reset link is invalid provide a valid token"
        );
    }

    const hashedToken = crypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex");

    const data = await getSession(`forgot:password:${hashedToken}`);

    if (!data?.verified) {
        return sendResponse(
            res,
            401,
            "This password reset link is invalid or has expired."
        );
    }

    await setSession(
        {
            ...data,
            by: "server",
            device
        },
        hashedToken,
        "forgot:password",
        "XX",
        "KEEPTTL"
    );

    return sendResponse(res, 200, {
        next: "set_new_password",
        info: {
            route: "/auth/reset-password/",
            request: "post"
        }
    });
};

export const resetPasswordHandler = async (req, res) => {
    const device = buildDeviceInfo(
        req.headers["user-agent"],
        req.body,
        await getIpDetails(req.realIp)
    );

    if (req.params?.token?.length !== Number(process.env.BYTE) * 2) {
        return sendResponse(
            res,
            400,
            "This password reset link is invalid provide a valid token"
        );
    }

    const hashedToken = crypto
        .createHash("sha256")
        .update(req.params.token)
        .digest("hex");

    const data = await getSession(`forgot:password:${hashedToken}`);

    if (data?.by !== "server") {
        return sendResponse(res, 401, {
            message: "You need to verify first",
            next: "verify_token",
            info: {
                route: "/auth/reset-password/",
                request: "get"
            }
        });
    }

    const user = await findUser({
        _id: data.userId
    });
    if (!user) {
        return sendResponse(res, 401, {
            message: "We couldn’t reset your password. Please start again.",
            action: "RESTART_PASSWORD_RESET"
        });
    }

    const score = await getRiskScore(device, data.device);

    if (score > 0) {
        await redis.del(`forgot:password:${hashedToken}`);
        return sendResponse(
            res,
            401,
            "We detected unusual activity. This request has been stopped for your security"
        );
    }

    const checkIsPass = await isValidPass(req.body.password, user.password);
    if (checkIsPass) {
        return sendResponse(res, 401, checkIsPass);
    }

    user.logout.push(getLogoutInfo("account_recovery", "logout-all", device));

    if (user.logout.length >= 15) {
        user.logout.shift();
    }

    await updateUser(
        user._id,
        {
            password: await generateHash(req.body.password),
            refreshToken: getInvalidateToken(user.refreshToken),
            logout: user.logout
        },
        {
            id: true
        }
    );

    await redis.del(`forgot:password:${hashedToken}`);

    sendPasswordResetAlert(user.email, device, user.name);

    return sendResponse(
        res,
        200,
        "Your password has been reset successfully. Please sign in again."
    );
};
