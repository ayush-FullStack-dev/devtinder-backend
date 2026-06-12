import AutoPay from "../../../../models/subscription/AutoPay.model.js";
import Subscription from "../../../../models/subscription/Subscription.model.js";
import PaymentOrder from "../../../../models/subscription/PaymentOrder.model.js";

import sendResponse from "../../../../helpers/sendResponse.js";

import { buildSubscriptionInfo } from "../../../../helpers/subscription/subscription.helper.js";

export const getSubscriptionStatus = async (req, res) => {
  const { currentProfile } = req.auth;

  const premium = buildSubscriptionInfo(currentProfile.premium);

  const currentSubscription = currentProfile.premium?.subscriptionId
    ? await Subscription.findById(currentProfile.premium.subscriptionId).select(
        "isTrial paymentOrderId autoPayOrderId",
      )
    : null;
  const isTrial = !!currentSubscription?.isTrial;

  let refundStatus = null;

  if (currentSubscription?.paymentOrderId) {
    const paymentOrder = await PaymentOrder.findById(
      currentSubscription.paymentOrderId,
    ).select("status");
    if (paymentOrder) refundStatus = paymentOrder.status;
  } else if (currentSubscription?.autoPayOrderId) {
    const autoPay = await AutoPay.findById(
      currentSubscription.autoPayOrderId,
    ).select("status");
    if (autoPay) refundStatus = autoPay.status;
  }

  const autopay = await AutoPay.findOne({
    userId: currentProfile._id,
    status: { $in: ["active", "authenticated"] },
  });

  const now = new Date();

  const daysLeft = premium.expiresAt
    ? Math.max(
        0,
        Math.ceil((new Date(premium.expiresAt) - now) / (1000 * 60 * 60 * 24)),
      )
    : null;

  return sendResponse(res, 200, {
    isActive: premium.isActive,
    plan: premium.tier || "free",
    isTrial,
    refundStatus,
    expiresAt: premium.expiresAt,
    daysLeft,
    autopay: autopay
      ? {
          enabled: true,
          status: autopay.status,
          nextChargeAt: autopay.nextChargeAt,
        }
      : {
          enabled: false,
        },

    canCancel: !!autopay,
    canUpgrade: premium.tier !== "gold",
    canDowngrade: premium.tier === "gold",
  });
};
