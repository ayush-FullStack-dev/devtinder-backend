import PaymentOrder from "../../../../../../models/subscription/PaymentOrder.model.js";
import Subscription from "../../../../../../models/subscription/Subscription.model.js";
import sendResponse from "../../../../../../helpers/sendResponse.js";

import { refundWebhookSchema } from "../../../../../../validators/user/payment/cashfree/refund.validator.js";

import { checkValidation } from "../../../../../../helpers/helpers.js";

export const validateRefundBody = (req, res, next) => {
  const validPayment = checkValidation(
    refundWebhookSchema,
    req,
    "Invalid refund payload",
  );

  if (!validPayment?.success) {
    return sendResponse(res, 400, validPayment.jsonResponse);
  }

  req.auth = { ...req.auth, value: validPayment.value };
  return next();
};

export const handleRefundWebhook = async (req, res) => {
  const { type, data } = req.auth.value;
  const isRefundStatusWebhook = type === "REFUND_STATUS_WEBHOOK";
  const isAutoRefundStatusWebhook = type === "AUTO_REFUND_STATUS_WEBHOOK";
  const refundData = isRefundStatusWebhook ? data.refund : data.auto_refund;

  const refundStatus =
    refundData.refund_status === "SUCCESS" ? "refunded" : "refund_failed";

  await PaymentOrder.findOneAndUpdate(
    { refund_id: refundData.refund_id },
    { $set: { status: refundStatus, refundedAt: new Date() } },
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

  await AutoPay.findOneAndUpdate(
    { refundId: refundData.refund_id },
    { $set: { status: refundStatus, refundedAt: new Date() } },
  );

  return sendResponse(res, 200);
};
