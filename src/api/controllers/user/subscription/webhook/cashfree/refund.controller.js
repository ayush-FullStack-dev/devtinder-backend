import PaymentOrder from "../../../../../../models/subscription/PaymentOrder.model.js";
import AutoPay from "../../../../../../models/subscription/AutoPay.model.js";
import Subscription from "../../../../../../models/subscription/Subscription.model.js";

import sendResponse from "../../../../../../helpers/sendResponse.js";
import {
  findProfile,
  updateProfile,
} from "../../../../../../services/profile.service.js";

import { refundWebhookSchema } from "../../../../../../validators/user/payment/cashfree/refund.validator.js";

import { checkValidation } from "../../../../../../helpers/helpers.js";

export const validateRefundBody = (req, res, next) => {
  const validate = refundWebhookSchema.validate(req.body);

  if (validate.error) {
    return sendResponse(res, 400);
  }

  req.auth = { ...req.auth, value: validate.value };
  return next();
};

export const handleRefundWebhook = async (req, res) => {
  const { type, data } = req.auth.value;

  const isRefundStatusWebhook = type === "REFUND_STATUS_WEBHOOK";
  const isAutoRefundStatusWebhook = type === "AUTO_REFUND_STATUS_WEBHOOK";

  if (!isRefundStatusWebhook && !isAutoRefundStatusWebhook) {
    return sendResponse(res, 400);
  }

  const refundData = isRefundStatusWebhook ? data.refund : data.auto_refund;

  const refundStatus =
    refundData.refund_status === "SUCCESS" ? "refunded" : "refund_failed";

  const paymentOrder = await PaymentOrder.findOneAndUpdate(
    { refundId: refundData.refund_id },
    { $set: { status: refundStatus, refundedAt: new Date() } },
    { returnDocument: "after" },
  );

  if (refundStatus === "refund_failed") {
    const subscription = await Subscription.findOneAndUpdate(
      {
        userId: paymentOrder?.userId,
        used: true,
        using: false,
        $or: [
          {
            carriedForwardDays: {
              $gt: 0,
            },
          },
          {
            isLifetime: true,
          },
        ],
      },
      {
        $set: {
          using: true,
          used: false,
        },
      },
      {
        returnDocument: "after",
      },
    ).sort({ updatedAt: -1 });

    const expiresAt = subscription
      ? subscription.isLifetime
        ? null
        : new Date(
            Date.now() + subscription.carriedForwardDays * 24 * 60 * 60 * 1000,
          )
      : null;

    await updateProfile(
      paymentOrder.userId,
      {
        $set: {
          "premium.type": subscription ? subscription.toPlan : "free",
          "premium.isLifetime": !!subscription?.isLifetime,
          "premium.since": subscription?.since ?? null,
          "premium.subscriptionId": subscription?._id ?? null,
          "premium.expiresAt": expiresAt,
        },
      },
      { id: true },
    );

    return sendResponse(res, 200);
  }

  const subscription = await Subscription.findOneAndUpdate(
    {
      userId: paymentOrder?.userId,
      used: false,
      using: false,
      $or: [{ isLifetime: true }, { carriedForwardDays: { $gt: 0 } }],
    },
    {
      using: true,
    },
  ).sort({ carriedForwardDays: -1 });

  const expiresAt = subscription
    ? subscription.isLifetime
      ? null
      : new Date(
          Date.now() + subscription.carriedForwardDays * 24 * 60 * 60 * 1000,
        )
    : null;

  await updateProfile(
    paymentOrder.userId,
    {
      $set: {
        "premium.type": subscription ? subscription.toPlan : "free",
        "premium.isLifetime": subscription?.isLifetime ? true : false,
        "premium.since": subscription ? subscription.since : null,
        "premium.subscriptionId": subscription ? subscription._id : null,
        "premium.expiresAt": expiresAt,
      },
    },
    { id: true },
  );

  return sendResponse(res, 200);
};

export const handleRefundAutoPayWebhook = async (req, res) => {
  const { type, data: refundData } = req.auth.value;

  const isSubscriptionRefundStatusWebhook =
    type === "SUBSCRIPTION_REFUND_STATUS";

  if (!isSubscriptionRefundStatusWebhook) {
    return sendResponse(res, 400);
  }

  const refundStatus =
    refundData.refund_status === "SUCCESS" ? "refunded" : "refund_failed";

  const autoPay = await AutoPay.findOneAndUpdate(
    { refundId: refundData?.refund_id },
    { $set: { status: refundStatus, refundedAt: new Date() } },
  );

  if (!autoPay) {
    return sendResponse(res, 200);
  }

  if (refundStatus === "refund_failed") {
    const subscription = await Subscription.findOneAndUpdate(
      {
        userId: autoPay?.userId,
        used: true,
        using: false,
        $or: [
          {
            carriedForwardDays: {
              $gt: 0,
            },
          },
          {
            isLifetime: true,
          },
        ],
      },
      {
        $set: {
          using: true,
          used: false,
        },
      },
      {
        returnDocument: "after",
      },
    ).sort({ updatedAt: -1 });

    const expiresAt = subscription
      ? subscription.isLifetime
        ? null
        : new Date(
            Date.now() + subscription.carriedForwardDays * 24 * 60 * 60 * 1000,
          )
      : null;

    await updateProfile(
      autoPay.userId,
      {
        $set: {
          "premium.type": subscription ? subscription.toPlan : "free",
          "premium.isLifetime": !!subscription?.isLifetime,
          "premium.since": subscription?.since ?? null,
          "premium.subscriptionId": subscription?._id ?? null,
          "premium.expiresAt": expiresAt,
        },
      },
      { id: true },
    );

    return sendResponse(res, 200);
  }

  const subscription = await Subscription.findOneAndUpdate(
    {
      userId: autoPay?.userId,
      used: false,
      using: false,
      $or: [{ isLifetime: true }, { carriedForwardDays: { $gt: 0 } }],
    },
    {
      using: true,
    },
  ).sort({ carriedForwardDays: -1 });

  const expiresAt = subscription
    ? subscription.isLifetime
      ? null
      : new Date(
          Date.now() + subscription.carriedForwardDays * 24 * 60 * 60 * 1000,
        )
    : null;

  await updateProfile(
    autoPay.userId,
    {
      $set: {
        "premium.type": subscription ? subscription.toPlan : "free",
        "premium.isLifetime": subscription?.isLifetime ? true : false,
        "premium.since": subscription ? subscription.since : null,
        "premium.subscriptionId": subscription ? subscription._id : null,
        "premium.expiresAt": expiresAt,
      },
    },
    { id: true },
  );

  return sendResponse(res, 200);
};
