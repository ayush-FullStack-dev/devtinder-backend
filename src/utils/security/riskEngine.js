import epochify from "epochify";
import { compareFingerprint } from "../fingerprint.js";
import { checkTimeManipulation } from "./timeManipulation.js";

import { compareNoSaltHash } from "../../helpers/hash.js";

export const getRiskLevel = score => {
    if (score <= 20) return "verylow";
    if (score <= 40) return "low";
    if (score <= 60) return "mid";
    if (score <= 80) return "high";
    return "veryhigh";
};

export const getRiskScore = async (current, last, others) => {
    let score = 0;

    const hour = new Date().getHours();
    const diffMin = epochify.getDiff(Date.now(), last.createdAt, "minute");
    const diffDay = epochify.getDiff(Date.now(), last.createdAt, "days");

    let timeManip = {
        success: true
    };

    if (others) {
        timeManip = checkTimeManipulation(others.time);
    }

    // Use pre-computed result if available (avoids duplicate bcrypt call from bindTokenToDevice)
    const fpValid = others?.validFp !== undefined
        ? others.validFp
        : await compareFingerprint(
              current,
              last.fingerprint ||
                  "$2b$10$EDstMQkU6TFzC9cRATw32OtFI15cveoGhDM0fgYlg9N.9zP2P9AAq"
          );

    let geoScore = 0;

    if (current.country !== last.country) {
        geoScore += 30;
    } else if (current.city !== last.city) {
        geoScore += 10;
    }

    if (current.timezone !== last.timezone) {
        geoScore += current.country === last.country ? 10 : 5;
    }

    score += Math.min(geoScore, 40);

    let deviceChanged = false;
    let deviceScore = 0;

    if (current.deviceId !== last.deviceId) {
        deviceChanged = true;
        deviceScore += 30;
    }

    if (deviceChanged && !fpValid) {
        deviceScore += 15;
    }

    if (deviceChanged && fpValid) {
        deviceScore -= 5;
    }

    score += Math.min(Math.max(deviceScore, 0), 45);

    if (diffMin < 10 && deviceChanged) {
        score += 15;
    }

    if (hour <= 5 && deviceChanged) {
        score += 5;
    }

    if (!timeManip?.success) {
        score += 20;
    }

    if (diffDay >= 30) {
        score += 15;
    }

    if (diffDay >= 30 && current.country !== last.country) {
        score += 10;
    }

    return Math.min(score, 100);
};

export const getTrustedScore = async (current, lastInfos) => {
    let score = 0;
    if (!lastInfos.length) return 0;

    const lastLogin = lastInfos[0];

    const sameDevice = compareNoSaltHash(current.deviceId, lastLogin.deviceId);
    if (!sameDevice) return 0;

    if (lastLogin.risk === "high" || lastLogin.risk === "veryhigh") {
        return 0;
    }

    const diffMs = Date.now() - lastLogin.createdAt.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours < 6) return 0;

    const validLogins = lastInfos.filter(l => {
        return (
            l.deviceId === lastLogin.deviceId &&
            (l.risk === "low" || l.risk === "verylow" || l.risk === "mid")
        );
    }).length;

    if (validLogins === 1) score += 10;
    else if (validLogins === 2) score += 20;
    else if (validLogins === 3) score += 35;
    else if (validLogins === 4) score += 50;
    else if (validLogins >= 5) score += 60;

    score += 20;
    score = Math.min(score, 100);

    return {
        trusted: score >= 70,
        score
    };
};
