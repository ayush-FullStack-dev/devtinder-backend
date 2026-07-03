import express from "express";
import {
  isLogin,
  findLoginData,
  validateBasicInfo,
} from "../../middlewares/auth/auth.middleware.js";
import { isProfileExists } from "../../middlewares/user/profile.middleware.js";
import { rateLimiter } from "../../middlewares/auth/security.middleware.js";
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
    limit: 50,
    window: 2,
    block: 5,
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
    limit: 10,
    window: 5,
    block: 10,
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
    limit: 5,
    window: 60,
    block: 30,
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
    limit: 5,
    window: 60,
    block: 30,
    route: "subscription:refund",
  }),
  refundSubscription,
);
router.post(
  "/refund-autopay",
  rateLimiter({
    limit: 5,
    window: 60,
    block: 30,
    route: "subscription:refund_autopay",
  }),
  refundAutopaySubscription,
);

router.post(
  "/pause-autopay",
  rateLimiter({
    limit: 10,
    window: 60,
    block: 5,
    route: "subscription:pause_autopay",
  }),
  pauseAutopay,
);
router.post(
  "/resume-autopay",
  rateLimiter({
    limit: 10,
    window: 60,
    block: 5,
    route: "subscription:resume_autopay",
  }),
  resumeAutopay,
);

router.post(
  "/cancel-autopay",
  rateLimiter({
    limit: 3,
    window: 60,
    block: 30,
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
