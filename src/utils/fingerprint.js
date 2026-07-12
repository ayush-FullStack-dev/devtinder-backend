import { getNoSaltHash, compareNoSaltHash } from "../helpers/hash.js";
import bcrypt from "bcryptjs";

const buildFpString = (userInfo) =>
  `${userInfo.browser}|${userInfo.os}|${userInfo.osVersion}|${userInfo.deviceModel}|${userInfo.deviceType}|${userInfo.deviceId}|${userInfo.userAgent}|${userInfo.deviceSize}|${userInfo.timezone}`;

export const fingerprintBuilder = (userInfo) => {
  const fp = typeof userInfo === "string" ? userInfo : buildFpString(userInfo);
  return getNoSaltHash(fp);
};

export const compareFingerprint = async (org, hash) => {
  if (!hash) return false;
  const fpString = typeof org === "string" ? org : buildFpString(org);

  if (hash.startsWith("$2b$") || hash.startsWith("$2a$")) {
    return bcrypt.compare(fpString, hash);
  }

  return compareNoSaltHash(fpString, hash);
};
