import axios from "axios";
import AutoPay from "../../../../models/subscription/AutoPay.model.js";
import Subscription from "../../../../models/subscription/Subscription.model.js";

import sendResponse from "../../../../helpers/sendResponse.js";

import { PLANS } from "../../../../constants/subscription/plans.constant.js";

import { BASE_CASHFREE_URL } from "../../../../constants/cashfree.constant.js";
import { cashfreeHeaders } from "../../../../config/cashfree.js";

import { buildSubscriptionInfo } from "../../../../helpers/subscription/subscription.helper.js";

export const activateTrial = async (req, res, next) => {
  const { currentProfile } = req.auth;
  const premium = buildSubscriptionInfo(currentProfile.premium);

  const trailInfo = await Subscription.findOne({
    userId: currentProfile._id,
    isTrial: true,
    action: "PURCHASE",
  }).populate([
    {
      path: "paymentOrderId",
      match: { status: { $nin: ["created", "failed"] } },
    },
    {
      path: "autoPayOrderId",
      match: {
        status: { $nin: ["created", "failed"] },
      },
    },
  ]);

  const alreadyUsed = !!(
    trailInfo &&
    (trailInfo.paymentOrderId || trailInfo.autoPayOrderId)
  );

  if (alreadyUsed) {
    return sendResponse(res, 403, {
      code: "TRIAL_ALREADY_USED",
      message: "You have already used your free trial",
    });
  }

  if (premium.isActive && premium.tier === "gold") {
    return sendResponse(res, 400, {
      code: "ALREADY_PREMIUM",
      message: "Trial is only available for free users",
    });
  }

  req.auth = {
    ...req.auth,
    method: req.body.method,
    premium,
    plan: PLANS["GOLD"],
  };
  return next();
};

export const createAutopay = async (req, res, next) => {
  const { user, currentProfile, premium, plan, gateway } = req.auth;
  const d = new Date();
  let nextMonth = new Date(d);
  let expiryYear = new Date(d);
  let response = null;
  const baseAmonut = 0;
  const actualPrice = plan.price;

  expiryYear.setFullYear(expiryYear.getFullYear() + 1);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  const autoPay = await AutoPay.create({
    userId: currentProfile._id,
    isTrial: true,
    nextChargeAt: nextMonth,
    mandateAmount: actualPrice,
    gateway,
    metadata: {
      ip: req.realIp,
      userAgent: req.headers["user-agent"],
      deviceId: req.body.deviceId,
    },
  });

  try {
    response = await axios.post(
      `${BASE_CASHFREE_URL}/subscriptions`,
      {
        subscription_id: `sub_${Date.now()}`,
        plan_details: {
          plan_id: "gold_monthly_trial_399",
        },
        customer_details: {
          customer_id: currentProfile._id.toString(),
          customer_name: currentProfile.displayName,
          customer_email: user.email,
          customer_phone: currentProfile.phone.mobile,
        },
        authorization_details: {
          authorization_amount_refund: true,
        },
        subscription_expiry_time: expiryYear,
        subscription_meta: {
          return_url: `${process.extra.DOMAIN_LINK}/payment/status?order_id=${autoPay._id}`,
        },
      },
      {
        headers: cashfreeHeaders,
      },
    );
  } catch (error) {
    await autoPay.delete();
    return sendResponse(res, 500, {
      message: "Failed to create subscription on payment gateway",
    });
  }

  const cashfreeSubscription = response.data;

  autoPay.gatewaySubscriptionId = cashfreeSubscription.subscription_id;
  autoPay.gatewayReferenceId = cashfreeSubscription.cf_subscription_id;

  await autoPay.save();

  await Subscription.create({
    userId: currentProfile._id,
    autoPayOrderId: autoPay._id,
    isTrial: true,
    action: "PURCHASE",
    fromPlan: premium.isActive ? premium.tier : "free",
    toPlan: plan.id.toLowerCase(),
  });

  req.auth.order = autoPay;
  req.auth.cashfreeSubscription = cashfreeSubscription;
  return next();
};
