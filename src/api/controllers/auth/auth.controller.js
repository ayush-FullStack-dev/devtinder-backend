import crypto from "crypto";
import sendResponse, { setCtxId } from "../../../helpers/sendResponse.js";

import { buildDeviceInfo } from "../../../helpers/buildDeviceInfo.js";
import { buildAuthInfo } from "../../../helpers/authEvent.js";
import { createAuthEvent } from "../../../services/authEvent.service.js";
import { getIpDetails } from "../../../helpers/ip.js";

import { fingerprintBuilder } from "../../../utils/fingerprint.js";
import {
    calculateLoginRisk,
    resolveRiskLevel,
    buildVerifyDecisionResponse,
    sendSecurityUpgrade
} from "../../../utils/security/loginRisk.js";

import { setSession, cleanupLogin } from "../../../services/session.service.js";

export const verifyIdentifyHandler = async (req, res, next) => {
    const ctxId = crypto.randomBytes(16).toString("hex");
    const { user } = req.auth;
    const time = req.body.clientTime || Date.now();
    const deviceInfo = buildDeviceInfo(
        req.headers["user-agent"],
        req.body,
       await getIpDetails(req.realIp)
    );
    deviceInfo.fingerprint = fingerprintBuilder(deviceInfo);
    const score = await calculateLoginRisk(user, deviceInfo, time);
    let riskLevel = await resolveRiskLevel(score, user.twoFA.enabled);
    riskLevel = riskLevel === "verylow" ? "low" : riskLevel;

    const response = await buildVerifyDecisionResponse(riskLevel, ctxId, user);

    if (riskLevel === "veryhigh" && !user.twoFA.enabled) {
        return sendSecurityUpgrade(user, res, deviceInfo);
    }

    await setSession(deviceInfo, ctxId, "verify:info");
    await setSession(
        {
            success: true,
            risk: riskLevel,
            allowedMethod: response.allowedMethod,
            stepUp: response.stepUp,
            riskScore: score,
            userId: user._id
        },
        ctxId,
        "verify:ctx"
    );

    return setCtxId(
        res,
        200,
        {
            ...response,
            message: "you need to verify"
        },
        ctxId,
        "verify_ctx"
    );
};

export const verifyVerificationHandler = (link, nextStep, others) => {
    return async (req, res, next) => {
        const { verify, ctxId, deviceInfo, info } = req.auth;

        if (!verify?.success) {
            await cleanupLogin(ctxId);
            await createAuthEvent(
                buildAuthInfo(deviceInfo, verify, {
                    _id: user._id,
                    eventType: "step_up",
                    success: false,
                    action: verify?.message || "verifaction_failed",
                    risk: info?.risk
                })
            );
            return sendResponse(res, 401, verify?.message || "Unauthorized");
        }

        if (link) {
            const hashedToken = crypto
                .createHash("sha256")
                .update(ctxId)
                .digest("hex");
            await setSession(
                {
                    verified: true,
                    ...verify,
                    risk: info?.risk
                },
                hashedToken,
                link,
                "EX",
                300
            );
            await setSession(
                {
                    verified: true,
                    ...deviceInfo
                },
                hashedToken,
                "verify:device",
                "EX",
                300
            );
        }

        if (others) {
            return sendResponse(res, 200, {
                ...others,
                token: ctxId,
                next: `${nextStep}${ctxId}`
            });
        }

        if (nextStep) {
            return sendResponse(res, 200, {
                next: nextStep
            });
        }

        return next();
    };
};
