import sendResponse from "../../../helpers/sendResponse.js";

import { findAuthEvent } from "../../../services/authEvent.service.js";
import { buildDeviceInfo } from "../../../helpers/buildDeviceInfo.js";
import AuthEvent from "../../../models/AuthEvent.model.js";
import { recommendedActions } from "../../../constants/auth.constant.js";
import {
  isValidWindow,
  riskSignals,
  evaluateSignals,
} from "../../../helpers/account.helper.js";
import { findUser } from "../../../services/user.service.js";
import { findProfile } from "../../../services/profile.service.js";

export const accountInfo = async (req, res) => {
  const { info } = req.auth;

  const user = await findUser({
    _id: info?._id,
  });

  if (!user) {
    return sendResponse(res, 401, {
      isLoggedIn: false,
      message: "Unauthorized",
    });
  }

  const profile = await findProfile({
    userId: user._id,
  });

  return sendResponse(res, 200, {
    isLoggedIn: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },

    profile: profile
      ? {
          exists: true,
          ...profile.toObject(),
        }
      : {
          exists: false,
          next: "create_profile",
          route: "/profile/setup",
        },
  });
};

export const securityEventHandler = async (req, res) => {
  const { user } = req.auth;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 20);

  const query = {
    userId: user._id,
  };

  if (req.query.types) {
    if (!Array.isArray(req.query.types)) {
      req.query.types = [req.query.types];
    }

    query.eventType = { $in: req.query.types };
  }

  const [total, logs] = await Promise.all([
    AuthEvent.countDocuments(query),
    AuthEvent.find(query)
      .limit(limit)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit),
  ]);

  const events = [];

  for (const log of logs) {
    const info = buildDeviceInfo(log.userAgent);
    events.push({
      eventId: log.id,
      eventType: log.eventType,
      action: log.action,
      success: log.success,
      risk: log.risk,
      platform: log.platform,
      loginMethod: log.loginMethod,
      mfaUsed: log.mfaUsed,
      location: {
        country: log.ipCountry,
        city: log.ipCity,
      },
      device: info.deviceName,
      model: info.deviceModel,
      createdAt: log.createdAt,
      reason: log.reason,
    });
  }

  return sendResponse(res, 200, {
    meta: {
      page,
      limit,
      totalEvents: total,
      totalPages: Math.ceil(total / limit),
    },
    events,
  });
};

export const activeRiskHandler = async (req, res) => {
  const { user, findedCurrent } = req.auth;
  const { window = "24h" } = req.query;

  const time = isValidWindow(window);

  if (time?.success === false) {
    return sendResponse(res, 400, time?.message);
  }

  const infos = await AuthEvent.find({
    userId: user._id,
    eventType: "login",
    createdAt: {
      $gte: time,
    },
  }).sort({ createdAt: -1 });

  const signals = riskSignals(window, infos, findedCurrent);

  const { risk, reasons } = evaluateSignals(signals);
  const reponse = {
    risk,
    reasons,
    actionRequired: false,
  };

  if (risk === "high") {
    reponse.recommendedActions = recommendedActions;
    reponse.actionRequired = true;
  }

  return sendResponse(res, 200, reponse);
};
