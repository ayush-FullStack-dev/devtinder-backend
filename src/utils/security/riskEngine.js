import epochify from "epochify";
import { compareFingerprint } from "../fingerprint.js";

import { compareNoSaltHash } from "../../helpers/hash.js";

export const getRiskLevel = (score) => {
  if (score <= 20) return "verylow";
  if (score <= 40) return "low";
  if (score <= 60) return "mid";
  if (score <= 80) return "high";
  return "veryhigh";
};

export const getRiskScore = async (current, last, others) => {
  let score = 0;

  let hour;

  try {
    if (current.timezone && current.timezone !== "UNKNOWN") {
      const formatter = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: current.timezone,
      });

      hour = parseInt(formatter.format(new Date()), 10);
    } else {
      hour = new Date().getHours();
    }
  } catch {
    hour = new Date().getHours();
  }

  const diffMin = epochify.getDiff(Date.now(), last.createdAt, "minutes");

  const diffDay = epochify.getDiff(Date.now(), last.createdAt, "days");

  const fpValid =
    others?.validFp !== undefined
      ? others.validFp
      : await compareFingerprint(
          current,
          last.fingerprint ||
            "$2b$10$EDstMQkU6TFzC9cRATw32OtFI15cveoGhDM0fgYlg9N.9zP2P9AAq",
        );

  let geoScore = 0;

  if (current.country && last.country && current.country !== last.country) {
    geoScore += 25;
  } else if (current.city && last.city && current.city !== last.city) {
    geoScore += 7;
  }

  if (current.timezone && last.timezone && current.timezone !== last.timezone) {
    geoScore += current.country === last.country ? 6 : 3;
  }

  score += Math.min(geoScore, 35);

  const deviceChanged = current.deviceId !== last.deviceId;

  let deviceScore = 0;

  if (deviceChanged) {
    deviceScore += 20;

    if (!fpValid) {
      deviceScore += 10;
    } else {
      deviceScore -= 5;
    }
  }

  score += Math.min(Math.max(deviceScore, 0), 30);

  if (deviceChanged && diffMin < 10) {
    score += 10;
  }

  if (deviceChanged && diffMin < 2) {
    score += 5;
  }

  if (deviceChanged && hour <= 5) {
    score += 4;
  }

  const ipChanged = current.ip && last.ip && current.ip !== last.ip;

  if (ipChanged) {
    score += 3;
  }

  if (ipChanged && deviceChanged) {
    score += 5;
  }

  if (ipChanged && deviceChanged && !fpValid) {
    score += 5;
  }

  if (diffDay >= 90) {
    score += 3;
  }

  if (diffDay >= 90 && deviceChanged) {
    score += 5;
  }

  if (
    diffDay >= 90 &&
    current.country &&
    last.country &&
    current.country !== last.country
  ) {
    score += 7;
  }

  score = Math.min(Math.max(score, 0), 100);

  return score;
};

export const getTrustedScore = async (current, lastInfos) => {
  let score = 0;

  if (!lastInfos.length) {
    return {
      trusted: false,
      score: 0,
    };
  }

  const lastLogin = lastInfos[0];

  const sameDevice = compareNoSaltHash(current.deviceId, lastLogin.deviceId);

  if (!sameDevice) {
    return {
      trusted: false,
      score: 0,
    };
  }

  if (lastLogin.risk === "high" || lastLogin.risk === "veryhigh") {
    return {
      trusted: false,
      score: 0,
    };
  }

  const diffMs = Date.now() - lastLogin.createdAt.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 6) {
    return {
      trusted: false,
      score: 0,
    };
  }

  const validLogins = lastInfos.filter((l) => {
    return (
      compareNoSaltHash(l.deviceId, lastLogin.deviceId) &&
      (l.risk === "low" || l.risk === "verylow")
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
    score,
  };
};
