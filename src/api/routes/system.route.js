import express from "express";

import { systemHealth } from "../controllers/system/system.controller.js";
import { getPing } from "../controllers/system/ping.controller.js";
import { rateLimiter } from "../../middlewares/auth/security.middleware.js";
import { SYSTEM_LIMITS } from "../../constants/rateLimit.constant.js";

const router = express.Router();

router.get(
  "/health/",
  rateLimiter({
    limit: SYSTEM_LIMITS["system:health"].limit,
    window: SYSTEM_LIMITS["system:health"].windowMinutes,
    block: SYSTEM_LIMITS["system:health"].blockMinutes,
    route: "system:health",
  }),
  systemHealth,
);

router.get(
  "/ping/",
  rateLimiter({
    limit: SYSTEM_LIMITS["system:ping"].limit,
    window: SYSTEM_LIMITS["system:ping"].windowMinutes,
    block: SYSTEM_LIMITS["system:ping"].blockMinutes,
    route: "system:ping",
  }),
  getPing,
);

export default router;
