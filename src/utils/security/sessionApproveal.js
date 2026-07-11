import crypto from "crypto";

import { setSession, getSession } from "../../services/session.service.js";
import { findPushSubscription } from "../../services/pushSubscription.service.js";
import { sendNotification } from "../../notifications/sendNotification.js";

const normalizeDeviceInfo = (deviceInfo) => ({
  ...(deviceInfo || {}),
  deviceName:
    deviceInfo?.deviceName || deviceInfo?.deviceModel || "Unknown device",
  location: deviceInfo?.location || deviceInfo?.city || "Unknown location",
});

export const sendSessionApproval = async (deviceInfo, user) => {
  const approvalId = crypto.randomBytes(16).toString("hex");
  const normalizedDeviceInfo = normalizeDeviceInfo(deviceInfo);
  const timeout = 120;

  await setSession(
    {
      userId: user._id,
      status: "pending",
      device: normalizedDeviceInfo,
      requestedAt: new Date(),
      used: false,
    },
    approvalId,
    `session:approval`,
    "EX",
    timeout,
  );

  const trustedDevices = Array.isArray(user?.trustedDevices)
    ? user.trustedDevices
    : [];

  for (const trustedDevice of trustedDevices) {
    const pushSubscription = await findPushSubscription({
      deviceIdHash: trustedDevice?.deviceIdHash,
    });

    if (!pushSubscription) {
      continue;
    }

    await sendNotification(pushSubscription, {
      type: "LOGIN_APPROVAL",
      title: "New sign-in attempt",
      body: `${normalizedDeviceInfo.deviceName} • ${normalizedDeviceInfo.location}`,
      tag: "login-alert",
      userId: user.id,
      url: `${process.extra.DOMAIN_LINK}/auth/account/approve-login/${approvalId}`,
    });
  }

  return {
    approvalId,
    timeout,
  };
};

export const checkSessionApproval = (approval, info) => {
  if (approval?.status === "approved") {
    return {
      success: true,
      method: "session_approval",
      code: "APPROVAL_ACCEPTED",
      stepup: info.risk === "high" || info.risk === "veryhigh",
    };
  }

  if (approval?.status === "declined") {
    return {
      success: false,
      code: "APPROVAL_REJECTED",
      message: "Session approval rejected by user",
      method: "session_approval",
    };
  }
};
