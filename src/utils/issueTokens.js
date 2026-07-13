import { signToken } from "../helpers/jwt.js";
import { getNoSaltHash } from "../helpers/hash.js";
import { buildAuthInfo } from "../helpers/authEvent.js";
import { getAccessToken, getRefreshToken } from "../helpers/token.js";
import { updateUser } from "../services/user.service.js";
import { createAuthEvent, findAuthEvent } from "../services/authEvent.service.js";
import { fingerprintBuilder } from "./fingerprint.js";
import { tokenBuilder } from "./cron.js";
import { getTrustedScore } from "./security/riskEngine.js";

/**
 * Issues access/refresh/trusted tokens, updates DB, logs auth event.
 * @param {{ user, deviceInfo, verify, info, refreshExpiry, userInfo }} opts
 * @returns {{ accessToken, refreshToken, trustedSession, updatedUser }}
 */
export const issueTokens = async ({ user, deviceInfo, verify, info, refreshExpiry, userInfo }) => {
  const accessToken = getAccessToken(user);

  const trustedSession = signToken({
    sub: user._id,
    did: deviceInfo.deviceId,
  });

  const refreshToken = getRefreshToken({ _id: user._id }, refreshExpiry.jwt);

  userInfo.fingerprint = fingerprintBuilder(userInfo);
  userInfo.token = refreshToken;

  user.refreshToken.push(tokenBuilder(userInfo));
  if (user.refreshToken.length > Number(process.env.ALLOWED_TOKEN)) {
    user.refreshToken.shift();
  }

  const lastInfos = await findAuthEvent(
    {
      userId: user._id,
      eventType: "login",
      success: true,
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    { many: true },
    { createdAt: -1 },
  );

  const trustInfo = await getTrustedScore(userInfo, lastInfos);
  const trustedDevices = user.trustedDevices || [];

  if (trustInfo.trusted) {
    const deviceIdHash = getNoSaltHash(deviceInfo.deviceId);
    const alreadyTrusted = trustedDevices.some((k) => k.deviceIdHash === deviceIdHash);
    if (!alreadyTrusted) {
      trustedDevices.push({
        deviceIdHash,
        name: deviceInfo.deviceName,
        country: deviceInfo.country,
        model: deviceInfo.model,
        location: deviceInfo.location,
        trustScore: trustInfo.score,
      });
    }
  }

  const updatedUser = await updateUser(
    user._id,
    { refreshToken: user.refreshToken, trustedDevices },
    { id: true },
  );

  await createAuthEvent(
    await buildAuthInfo(deviceInfo, verify, {
      _id: user._id,
      eventType: "login",
      mfaUsed: verify?.mfaUsed || "none",
      loginMethod: verify?.loginMethod,
      success: true,
      trusted: trustInfo.score >= 70,
      risk: info.risk,
    }),
  );

  return { accessToken, refreshToken, trustedSession, updatedUser };
};
