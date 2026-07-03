import express from "express";
import {
  isLogin,
  findLoginData,
} from "../../middlewares/auth/auth.middleware.js";
import { isProfileExists } from "../../middlewares/user/profile.middleware.js";
import { rateLimiter } from "../../middlewares/auth/security.middleware.js";

import { subscribePush } from "../controllers/push/subscribe.controller.js";
import { unsubscribePush } from "../controllers/push/unsubscribe.controller.js";

const router = express.Router();

router.post(
  "/subscribe",
  isLogin,
  findLoginData,
  isProfileExists,
  rateLimiter({
    limit: 20,
    window: 5,
    block: 5,
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
    limit: 20,
    window: 5,
    block: 5,
    route: "push:unsubscribe",
  }),
  unsubscribePush,
);

export default router;
