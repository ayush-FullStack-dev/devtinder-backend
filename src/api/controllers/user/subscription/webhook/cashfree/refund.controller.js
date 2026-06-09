import PaymentOrder from "../../../../../../models/subscription/PaymentOrder.model.js";
import AutoPay from "../../../../../../models/subscription/AutoPay.model.js";
import sendResponse from "../../../../../../helpers/sendResponse.js";

import { refundWebhookSchema } from "../../../../../../validators/user/payment/cashfree/refund.validator.js";

import { checkValidation } from "../../../../../../helpers/helpers.js";

export const validateRefundBody = (req, res, next) => {
  const validate = refundWebhookSchema.validate(req.body);

  if (validate.error) {
    console.log("refundWebhookValidationError", validate.error);
    return sendResponse(res, 400);
  }

  req.auth = { ...req.auth, value: validate.value };
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
