import express from "express";

import { rateLimiter } from "../../middlewares/auth/security.middleware.js";
import { systemHealth } from "../controllers/system/system.controller.js";

const router = express.Router();

router.get(
  "/health/",
  rateLimiter({
    limit: 60,
    window: 1,
    block: 2,
    route: "health",
  }),
  systemHealth,
);

export default router;
