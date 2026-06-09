import sendResponse from "../../../../helpers/sendResponse.js";
import Subscription from "../../../../models//subscription/Subscription.model.js";
import { daysInMonth } from "../../../../helpers/time.js";
import { BASE_CASHFREE_URL } from "../../../../constants/cashfree.constant.js";
import axios from "axios";
import { cashfreeHeaders } from "../../../../config/cashfree.js";
import AutoPay from "../../../../models/subscription/AutoPay.model.js";
import PaymentOrder from "../../../../models/subscription/PaymentOrder.model.js";

export const refundAutopaySubscription = async (req, res) => {
  const { currentProfile } = req.auth;
  let refundInfo = null;

  const subscriptionInfo = await Subscription.findOne({
    userId: currentProfile._id,
    isTrial: false,
    using: true,
    used: false,
  }).populate([
    {
      path: "autoPayOrderId",
      match: {
        status: { $in: ["active"] },
      },
    },
  ]);

  const availableRefund = !!(
    subscriptionInfo && subscriptionInfo.autoPayOrderId
  );

  if (!availableRefund) {
    return sendResponse(res, 400, {
      message: "No active autopay subscription found for refund",
    });
  }

  const startDate = new Date(subscriptionInfo.createdAt);

  const productInfo = subscriptionInfo.autoPayOrderId;

  const productPrice = productInfo.amount.final;
  const perDayPrice =
    productPrice /
    daysInMonth(startDate.getFullYear(), startDate.getMonth() + 1);

  const availableRefundAmount =
    subscriptionInfo.carriedForwardDays * perDayPrice;
  const refundAmount = Math.max(0, Math.floor(availableRefundAmount * 0.95));

  if (refundAmount <= 0) {
    return sendResponse(res, 400, {
      code: "REFUND_NOT_AVAILABLE",
      message: "No refundable amount is available for this subscription.",
    });
  }

  try {
    const res = await axios.post(
      `${BASE_CASHFREE_URL}/subscriptions/${productInfo.gatewaySubscriptionId}/refund/`,
      {
        subscription_id: productInfo.gatewaySubscriptionId,
        refund_id: `refund_${Date.now() + Math.floor(Math.random() * 1000)}`,
        refund_amount: refundAmount,
        refund_note: "partial refund",
        refund_speed: "INSTANT",
      },
      {
        headers: cashfreeHeaders,
      },
    );

    refundInfo = res.data;

    subscriptionInfo.used = true;
    subscriptionInfo.using = false;
    subscriptionInfo.carriedForwardDays = 0;

    await AutoPay.findByIdAndUpdate(productInfo._id, {
      status: "refund_pending",
      refundId: refundInfo.refund_id,
    });

    await subscriptionInfo.save();
  } catch (error) {
    return sendResponse(res, 500, {
      message: "Failed to process autopay refund",
      error: error.message,
    });
  }

  return sendResponse(res, 200, {
    message: "Refund is being processed",
    refundStatus: "PENDING",
    refundInfo,
  });
};

export const refundSubscription = async (req, res) => {
  const { currentProfile } = req.auth;
  let refundInfo = null;

  const subscriptionInfo = await Subscription.findOne({
    userId: currentProfile._id,
    isTrial: false,
    using: true,
    used: false,
  }).populate([
    {
      path: "paymentOrderId",
    },
  ]);

  const availableRefund = !!(
    subscriptionInfo && subscriptionInfo.paymentOrderId
  );

  if (!availableRefund) {
    return sendResponse(res, 400, {
      message: "No active payment subscription found for refund",
    });
  }

  const startDate = new Date(subscriptionInfo.createdAt);

  const productInfo = subscriptionInfo.paymentOrderId;

  const productPrice = productInfo.amount.final;
  const perDayPrice =
    productPrice /
    daysInMonth(startDate.getFullYear(), startDate.getMonth() + 1);

  const availableRefundAmount =
    subscriptionInfo.carriedForwardDays * perDayPrice;
  const refundAmount = Math.max(0, Math.floor(availableRefundAmount * 0.95));

  if (refundAmount === 0) {
    return sendResponse(res, 400, {
      code: "REFUND_NOT_AVAILABLE",
      message: "No refundable amount is available for this subscription.",
    });
  }

  try {
    const res = await axios.post(
      `${BASE_CASHFREE_URL}/orders/${productInfo._id}/refunds`,
      {
        refund_amount: refundAmount,
        refund_id: `refund_${Date.now() + Math.floor(Math.random() * 1000)}`,
        refund_note: "partial refund",
        refund_speed: "INSTANT",
      },
      {
        headers: cashfreeHeaders,
      },
    );

    refundInfo = res.data;

    subscriptionInfo.used = true;
    subscriptionInfo.using = false;
    subscriptionInfo.carriedForwardDays = 0;

    await PaymentOrder.findByIdAndUpdate(productInfo._id, {
      status: "refund_pending",
      refundId: refundInfo.refund_id,
    });

    await subscriptionInfo.save();
  } catch (error) {
    console.log(error);
    return sendResponse(res, 500, {
      message: "Failed to process refund",
      error: error.message,
    });
  }

  return sendResponse(res, 200, {
    message: "Refund is being processed",
    refundStatus: "PENDING",
    refundInfo,
  });
};
