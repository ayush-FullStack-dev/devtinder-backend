import express from "express";
import {
  isLogin,
  findLoginData,
} from "../../middlewares/auth/auth.middleware.js";
import { isProfileExists } from "../../middlewares/user/profile.middleware.js";
import { rateLimiter } from "../../middlewares/auth/security.middleware.js";
import { PUSH_LIMITS } from "../../constants/rateLimit.constant.js";

import { subscribePush } from "../controllers/push/subscribe.controller.js";
import { unsubscribePush } from "../controllers/push/unsubscribe.controller.js";

const router = express.Router();

router.post(
  "/subscribe",
  isLogin,
  findLoginData,
  isProfileExists,
  rateLimiter({
    limit: PUSH_LIMITS["push:subscribe"].maxRequests,
    window: PUSH_LIMITS["push:subscribe"].windowMinutes,
    block: PUSH_LIMITS["push:subscribe"].blockMinutes,
    route: "push:subscribe",
  }),
  subscribePush,
);

router.delete(
  "/unsubscribe",
  isLogin,
  findLoginData,
  isProfileExists,
  rateLimiter({
    limit: PUSH_LIMITS["push:unsubscribe"].maxRequests,
    window: PUSH_LIMITS["push:unsubscribe"].windowMinutes,
    block: PUSH_LIMITS["push:unsubscribe"].blockMinutes,
    route: "push:unsubscribe",
  }),
  unsubscribePush,
);

export default router;
