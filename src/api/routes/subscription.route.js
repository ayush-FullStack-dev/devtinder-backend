import express from "express";
import {
  isLogin,
  findLoginData,
  validateBasicInfo,
} from "../../middlewares/auth/auth.middleware.js";
import { isProfileExists } from "../../middlewares/user/profile.middleware.js";
import { rateLimiter } from "../../middlewares/auth/security.middleware.js";
import { SUBSCRIPTION_LIMITS } from "../../constants/rateLimit.constant.js";
import { checkPremiumStatus } from "../../middlewares/user/premium.middleware.js";

import { subscriptionPlans } from "../controllers/user/subscription/plans.controller.js";
import {
  validatePlan,
  validateCoupon,
  initlizeGateway,
  finalizeAmount,
  createOrder,
  sendPayment,
} from "../controllers/user/subscription/checkout.controller.js";
import {
  activateTrial,
  createAutopay,
} from "../controllers/user/subscription/activate-trial.controller.js";
import { subscriptionHistory } from "../controllers/user/subscription/history.controller.js";
import { getSubscriptionStatus } from "../controllers/user/subscription/substatus.controller.js";

import {
  validateBody,
  validateOrder,
  validateSigntaure,
  handlePaymentCoupon,
  handlePaymentSuccess,
} from "../controllers/user/subscription/webhook/cashfree/verifyPayment.controller.js";
import {
  validateSubscriptionBody,
  handleAutoPayWebhook,
  handleAutoPaySuccess,
} from "../controllers/user/subscription/webhook/cashfree/autoPay.controller.js";
import { cancelAutopay } from "../controllers/user/subscription/cancel-autopay.controller.js";
import {
  pauseAutopay,
  resumeAutopay,
} from "../controllers/user/subscription/autopay.controller.js";
import {
  refundSubscription,
  refundAutopaySubscription,
} from "../controllers/user/subscription/refund.controller.js";
import {
  handleRefundWebhook,
  validateRefundBody,
  handleRefundAutoPayWebhook,
} from "../controllers/user/subscription/webhook/cashfree/refund.controller.js";

const router = express.Router();

router.use(
  /^\/(?!webhook|verify).*$/,
  isLogin,
  findLoginData,
  isProfileExists,
  checkPremiumStatus,
  rateLimiter({
    limit: SUBSCRIPTION_LIMITS["subscription:base"].maxRequests,
    window: SUBSCRIPTION_LIMITS["subscription:base"].windowMinutes,
    block: SUBSCRIPTION_LIMITS["subscription:base"].blockMinutes,
    route: "subscription:base",
  }),
);

router.get("/plans", subscriptionPlans);
router.get("/subscription-status", getSubscriptionStatus);
router.get("/history", validateBasicInfo, subscriptionHistory);

router.post(
  "/checkout",
  validateBasicInfo,
  rateLimiter({
    limit: SUBSCRIPTION_LIMITS["subscription:checkout"].maxRequests,
    window: SUBSCRIPTION_LIMITS["subscription:checkout"].windowMinutes,
    block: SUBSCRIPTION_LIMITS["subscription:checkout"].blockMinutes,
    route: "subscription:checkout",
  }),
  validatePlan,
  initlizeGateway,
  validateCoupon,
  finalizeAmount,
  createOrder,
  sendPayment,
);

router.post(
  "/activate-trial",
  validateBasicInfo,
  rateLimiter({
    limit: SUBSCRIPTION_LIMITS["subscription:activate_trial"].maxRequests,
    window: SUBSCRIPTION_LIMITS["subscription:activate_trial"].windowMinutes,
    block: SUBSCRIPTION_LIMITS["subscription:activate_trial"].blockMinutes,
    route: "subscription:activate_trial",
  }),
  activateTrial,
  initlizeGateway,
  createAutopay,
  sendPayment,
);

router.post(
  "/refund",
  rateLimiter({
    limit: SUBSCRIPTION_LIMITS["subscription:refund"].maxRequests,
    window: SUBSCRIPTION_LIMITS["subscription:refund"].windowMinutes,
    block: SUBSCRIPTION_LIMITS["subscription:refund"].blockMinutes,
    route: "subscription:refund",
  }),
  refundSubscription,
);
router.post(
  "/refund-autopay",
  rateLimiter({
    limit: SUBSCRIPTION_LIMITS["subscription:refund_autopay"].maxRequests,
    window: SUBSCRIPTION_LIMITS["subscription:refund_autopay"].windowMinutes,
    block: SUBSCRIPTION_LIMITS["subscription:refund_autopay"].blockMinutes,
    route: "subscription:refund_autopay",
  }),
  refundAutopaySubscription,
);

router.post(
  "/pause-autopay",
  rateLimiter({
    limit: SUBSCRIPTION_LIMITS["subscription:pause_autopay"].maxRequests,
    window: SUBSCRIPTION_LIMITS["subscription:pause_autopay"].windowMinutes,
    block: SUBSCRIPTION_LIMITS["subscription:pause_autopay"].blockMinutes,
    route: "subscription:pause_autopay",
  }),
  pauseAutopay,
);
router.post(
  "/resume-autopay",
  rateLimiter({
    limit: SUBSCRIPTION_LIMITS["subscription:resume_autopay"].maxRequests,
    window: SUBSCRIPTION_LIMITS["subscription:resume_autopay"].windowMinutes,
    block: SUBSCRIPTION_LIMITS["subscription:resume_autopay"].blockMinutes,
    route: "subscription:resume_autopay",
  }),
  resumeAutopay,
);

router.post(
  "/cancel-autopay",
  rateLimiter({
    limit: SUBSCRIPTION_LIMITS["subscription:cancel_autopay"].maxRequests,
    window: SUBSCRIPTION_LIMITS["subscription:cancel_autopay"].windowMinutes,
    block: SUBSCRIPTION_LIMITS["subscription:cancel_autopay"].blockMinutes,
    route: "subscription:cancel_autopay",
  }),
  cancelAutopay,
);

router.post(
  "/webhook/autopay",
  validateSigntaure,
  validateSubscriptionBody,
  handleAutoPayWebhook,
  handleAutoPaySuccess,
);

router.post(
  "/webhook/payment",
  validateSigntaure,
  validateBody,
  validateOrder,
  handlePaymentCoupon,
  handlePaymentSuccess,
);

router.post(
  "/webhook/refund/payment",
  validateSigntaure,
  validateRefundBody,
  handleRefundWebhook,
);

router.post(
  "/webhook/refund/autopay",
  validateSigntaure,
  validateRefundBody,
  handleRefundAutoPayWebhook,
);

export default router;
