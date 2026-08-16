import express from "express";
import {
    isLogin,
    findLoginData
} from "../../middlewares/auth/auth.middleware.js";
import { isProfileExists } from "../../middlewares/user/profile.middleware.js";
import { rateLimiter } from "../../middlewares/auth/security.middleware.js";
import { PAYMENT_LIMITS } from "../../constants/rateLimit.constant.js";

import {
    getCoupons,
    validateCoupon
} from "../controllers/user/payment/coupon.controller.js";

const router = express.Router();

router.use(
    isLogin,
    findLoginData,
    isProfileExists,
    rateLimiter({
        limit: PAYMENT_LIMITS["payment:base"].maxRequests,
        window: PAYMENT_LIMITS["payment:base"].windowMinutes,
        block: PAYMENT_LIMITS["payment:base"].blockMinutes,
        route: "payment:base"
    })
);

router.get("/coupons", getCoupons);
router.post("/coupon", validateCoupon);

export default router;
