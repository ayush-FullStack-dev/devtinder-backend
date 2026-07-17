import crypto from "crypto";

import redis from "../config/redis.js";


export const isDeviceTrusted = async trust => {
    let isTrustedDevice = await redis.get(`trustedDevice:${trust.trustedId}`);
    
    isTrustedDevice = JSON.parse(isTrustedDevice);

    if (trust.user?._id.toString() === isTrustedDevice?.userId?.toString()) {
        return {
            success: true,
            method: "trusted_device"
        };
    }

    const isRemeberDevice = await redis.exists(
        `trusted:${trust.ctxId}:${trust.fingerprint}`
    );

    if (isRemeberDevice) {
        return {
            success: true,
            method: "remembered_device"
        };
    }
    return null;
};

export const setDeviceTrusted = async trust => {
    const trustedId = crypto.randomBytes(16).toString("hex");

    if (trust.trustDevice) {
        const info = JSON.stringify(trust.userInfo);
        await redis.set(
            `trustedDevice:${trustedId}`,
            info,
            "PX",
            trust.userInfo.expiresAt - Date.now()
        );
        return {
            success: true,
            trustedId,
            method: "trustedDevice"
        };
    }

    if (trust.rememberDevice) {
        await redis.set(
            `trusted:${trust.ctxId}:${trust.userInfo.fingerprintHash}`,
            true,
            "EX",
            60 * 60 * 24 * 30
        );

        return {
            success: true,
            method: "remeberDevice"
        };
    }

    return { success: false };
};
