import AutoPay from "../../../../../../models/subscription/AutoPay.model.js";
import Subscription from "../../../../../../models/subscription/Subscription.model.js";

import sendResponse from "../../../../../../helpers/sendResponse.js";
import { PLANS } from "../../../../../../constants/subscription/plans.constant.js";
import { updateProfile } from "../../../../../../services/profile.service.js";

import { subscriptionValidator } from "../../../../../../validators/user/payment/cashfree/subscription.validator.js";

import { checkValidation } from "../../../../../../helpers/helpers.js";

import { mapStatus } from "../../../../../../helpers/subscription/subscription.helper.js";
import { daysInMonth } from "../../../../../../helpers/time.js";

export const validateSubscriptionBody = (req, res, next) => {
  const validPayment = checkValidation(
    subscriptionValidator,
    req,
    "Invalid subscription payload",
  );

  if (!validPayment?.success) {
    return sendResponse(res, 400, validPayment.jsonResponse);
  }

  req.auth = { ...req.auth, value: validPayment.value };
  return next();
};

export const handleAutoPayWebhook = async (req, res, next) => {
  let date = new Date();
  date.setMonth(date.getMonth() + 1);
  const { type, data } = req.auth.value;
  const subscriptionId = data.subscription_id;
  const autoPayStatus = mapStatus(
    data.authorization_details.authorization_status,
  );

  req.auth.next_charge_time = date;

  const autopay = await AutoPay.findOneAndUpdate(
    { gatewaySubscriptionId: subscriptionId },
    { expiresAt: null },
    { returnDocument: "after" },
  );

  if (!autopay) {
    return sendResponse(res, 200);
  }

  if (type === "SUBSCRIPTION_AUTH_STATUS") {
    await AutoPay.updateOne(
      { _id: autopay._id },
      {
        status: autoPayStatus,
        nextChargeAt: req.auth.next_charge_time,
      },
    );

    if (autoPayStatus === "active") {
      req.auth.autopay = autopay;
      return next();
    }
  } else if (type === "SUBSCRIPTION_STATUS_CHANGED") {
    await AutoPay.updateOne({ _id: autopay._id }, { status: autoPayStatus });

    return sendResponse(res, 200);
  } else if (
    type === "SUBSCRIPTION_PAYMENT_SUCCESS" &&
    data.payment_type === "charge"
  ) {
    req.auth.autopay = autopay;
    return next();
  } else if (type === "SUBSCRIPTION_PAYMENT_FAILED") {
    await AutoPay.updateOne({ _id: autopay._id }, { status: "paused" });

    return sendResponse(res, 200);
  }

  return sendResponse(res, 200);
};

export const handleAutoPaySuccess = async (req, res) => {
  const { next_charge_time, autopay } = req.auth;
  const { type } = req.auth.value;

  const carriedForwardDays = daysInMonth(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
  );

  const subscription = await Subscription.findOneAndUpdate(
    { autoPayOrderId: autopay._id },
    { $set: { carriedForwardDays } },
    { returnDocument: "after" },
  );

  if (!subscription) {
    return sendResponse(res, 200);
  }

  if (type === "SUBSCRIPTION_PAYMENT_SUCCESS") {
    await Subscription.findByIdAndUpdate(subscription._id, {
      using: false,
      used: true,
      carriedForwardDays: 0,
    });

    await Subscription.create({
      userId: subscription.userId,
      autoPayOrderId: autopay._id,
      type: "paid",
      action: "PURCHASE",
      fromPlan: subscription.fromPlan,
      toPlan: subscription.toPlan,
      using: true,
      carriedForwardDays,
    });
  }

  const plan = PLANS[subscription.toPlan.toUpperCase()];
  const day = 1000 * 60 * 60 * 24;
  const expireIn = day * carriedForwardDays;

  await updateProfile(subscription.userId, {
    $inc: {
      "packs.benefits.boosts": plan.features.monthlyBoostCredits,
    },
    $set: {
      premium: {
        type: subscription.toPlan,
        isLifetime: subscription.isLifetime,
        since: new Date(),
        subscriptionId: subscription._id,
        expiresAt: subscription.isLifetime
          ? null
          : new Date(Date.now() + expireIn),
      },
    },
  });

  await AutoPay.updateOne(
    { _id: autopay._id },
    {
      status: "active",
      nextChargeAt: new Date(next_charge_time),
    },
  );

  return sendResponse(res, 200);
};
