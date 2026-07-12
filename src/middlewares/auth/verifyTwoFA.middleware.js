import verifyTwoFAValidators from "../../validators/auth/verifyTwoFA.validator.js";

import sendResponse from "../../helpers/sendResponse.js";

import redis from "../../config/redis.js";
import crypto from "crypto";

import { buildDeviceInfo } from "../../helpers/buildDeviceInfo.js";
import { decryptData } from "../../helpers/encryption.js";
import { verifyHash } from "../../helpers/hash.js";
import { twoFaRefreshExpiry, checkValidation } from "../../helpers/helpers.js";
import { getTime } from "../../helpers/time.js";
import { getIpDetails } from "../../helpers/ip.js";

import { isDeviceTrusted } from "../../services/auth.service.js";
import { findUser, updateUser } from "../../services/user.service.js";
import { cleanup2fa, getSession } from "../../services/session.service.js";

import { getRiskScore } from "../../utils/security/riskEngine.js";
import { verifyTotpCode } from "../../utils/security/totp.js";

export const verifyTwoFAValidation = async (req, res, next) => {
    req.auth = {};
    const time = getTime(req);
    const trustedDeviceId = req.signedCookies.trustedDeviceId;
    const loginMethod = req.body?.method?.toUpperCase();

    const ctxId = req.signedCookies?.twoFA_ctx;

    const validate = checkValidation(
        verifyTwoFAValidators,
        req,
        "vaildation failed for verify twoFactorAuthentication"
    );

    if (!validate?.success) {
        return sendResponse(res, 400, validate.jsonResponse);
    }

    const user = await findUser({
        email: req.body.email
    });

    if (!user) {
        return sendResponse(res, 401, {
            message: "user not found!"
        });
    }

    const getDeviceInfo = buildDeviceInfo(
        req.headers["user-agent"],
        validate.value,
        await getIpDetails(req.realIp)
    );

    // validate that the 2FA session actually exists
    let isValid = await getSession(`2fa:session:${ctxId}`);

    if (!isValid?.start) {
        return sendResponse(res, 401, {
            message: "2FA session not found start first 2fa",
            route: "/auth/verify-2fa/start/"
        });
    }

    // getting  /start route values
    let savedInfo = await getSession(`device:info:${ctxId}`);
    let savedFp = await getSession(`2fa:fp:start:${ctxId}`, "string");
    savedInfo.fingerprint = savedFp;
    getDeviceInfo.deviceSize = savedInfo.deviceSize;

    // if any device/geo/fp change happened after /start → block immediately
    const riskScore = await getRiskScore(getDeviceInfo, savedInfo, { time });
    if (riskScore > 0) {
        await cleanup2fa(ctxId);
        return sendResponse(
            res,
            401,
            "We detected unusual activity. This request has been stopped for your security"
        );
    }

    if (isValid.method !== loginMethod) {
        await cleanup2fa(ctxId);
        return sendResponse(res, 401, {
            message: "This req prevent method-hopping attack!"
        });
    }

    // check device exist in trusted if exist then don't ask 2fa direct login else 2fa continue
    if (user.logout?.length) {
        const lastLogout = user.logout[user.logout.length - 1];
        if (lastLogout.logout !== "logout-all") {
            req.auth.verify = await isDeviceTrusted({
                ctxId,
                trustedId: trustedDeviceId,
                user,
                fingerprint: savedFp
            });
        }
    } else {
        req.auth.verify = await isDeviceTrusted({
            ctxId,
            user,
            trustedId: trustedDeviceId,
            fingerprint: savedFp
        });
    }

    req.auth.refreshExpiry = twoFaRefreshExpiry();
    req.auth.user = user;
    req.auth.ctxId = ctxId;
    req.auth.time = time;
    req.auth.loginMethod = loginMethod;
    req.auth.riskLevel = await getSession(`2fa:data:${ctxId}`).risk;
    req.auth.code = validate.value.code;
    req.auth.method = user.twoFA.twoFAMethods;
    req.auth.deviceInfo = getDeviceInfo;
    req.auth.hashedToken = crypto
        .createHash("sha256")
        .update(ctxId)
        .digest("hex");
    req.auth.userInfo = {
        userId: user._id,
        fingerprintHash: savedFp,
        deviceName: `${getDeviceInfo.browser} on ${getDeviceInfo.os}`,
        createdAt: new Date(),
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
    };
    next();
};

export const verifyTwoFAEmail = async (req, res, next) => {
    let { user, loginMethod, hashedToken, code, method, verify, ctxId } =
        req.auth;

    if (verify?.success !== undefined) {
        return next();
    }

    if (loginMethod === "EMAIL" && !method.email.enabled) {
        await cleanup2fa(ctxId, hashedToken);
        return sendResponse(res, 401, {
            message: "email is disabled!"
        });
    }

    if (loginMethod === "EMAIL" && method.email.enabled) {
        const getOtp = await getSession(`otp:${hashedToken}`, "string");
        if (!getOtp) {
            await cleanup2fa(ctxId);
            return sendResponse(res, 401, {
                message: "one time password is invalid!"
            });
        }
        const checkOtp = await verifyHash(code, getOtp);
        if (!checkOtp) {
            req.auth.verify = {
                success: false,
                message: "one time password is currpted or  invalid!",
                method: "email_otp"
            };
        } else {
            await redis.del(`otp:${hashedToken}`);
            req.auth.verify = { success: true, method: "email_otp" };
        }
    }

    return next();
};

export const verifyTwoFATotp = async (req, res, next) => {
    let { user, loginMethod, hashedToken, code, method, verify, ctxId } =
        req.auth;
    if (verify?.success) return next();

    if (loginMethod === "TOTP" && !method.totp.enabled) {
        await cleanup2fa(ctxId, hashedToken);
        return sendResponse(res, 403, {
            message: "totp in disabled!"
        });
    }

    if (loginMethod === "TOTP" && method.totp.enabled) {
        const isCodeValid = await getSession(
            `totp:last:${hashedToken}`,
            "string"
        );

        if (isCodeValid === code) {
            await cleanup2fa(ctxId, hashedToken);
            return sendResponse(res, 401, {
                message: "replay attack detected"
            });
        }

        req.auth.verify = verifyTotpCode(code, method.totp.secret);

        if (req.auth.verify?.success) {
            await redis.set(`totp:last:${hashedToken}`, code, "EX", 60);
            await updateUser(
                { _id: user._id },
                {
                    $set: {
                        [`${method}.totp.verified`]: true,
                        [`${method}.totp.lastUsedAt`]: new Date()
                    }
                }
            );
        }
    }

    return next();
};

export const verifyTwoFABackupcode = async (req, res, next) => {
    let { user, loginMethod, code, hashedToken, method, verify, ctxId } =
        req.auth;

    if (verify?.success) return next();

    if (loginMethod === "BACKUPCODE" && !method.backupCodes.enabled) {
        await cleanup2fa(ctxId, hashedToken);
        return sendResponse(res, 401, {
            message: "BackupCode is disabled!"
        });
    }

    if (loginMethod === "BACKUPCODE" && method.backupCodes.enabled) {
        let existsCode = null;
        for (const backupcode of method.backupCodes.codes) {
            const verifyCode = await decryptData(
                backupcode.iv,
                backupcode.content,
                backupcode.tag
            );
            if (verifyCode === code) {
                existsCode = {
                    success: true,
                    id: backupcode._id
                };
                break;
            }
        }

        if (!existsCode?.success) {
            req.auth.verify = {
                success: false,
                message: "Backup code is invalid!",
                method: "backup_code"
            };
        } else {
            req.auth.verify = { success: true, method: "backup_code" };

            await updateUser(
                { _id: user._id },
                {
                    "twoFA.twoFAMethods.backupCodes.codes":
                        method.backupCodes.codes.filter(
                            backupcode => backupcode._id !== existsCode.id
                        ),
                    "twoFA.twoFAMethods.backupCodes.lastUsedAt": new Date()
                }
            );
        }

        return next();
    }

    return next();
};
