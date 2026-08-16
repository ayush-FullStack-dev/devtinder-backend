import express from "express";
import {
  isLogin,
  findLoginData,
} from "../../middlewares/auth/auth.middleware.js";
import {
  isProfileExists,
  isProfileBlocked,
} from "../../middlewares/user/profile.middleware.js";
import {
  checkPremiumStatus,
  checkPacksStatus,
} from "../../middlewares/user/premium.middleware.js";
import { swipeProfile } from "../../middlewares/user/swipe.middleware.js";
import { rateLimiter } from "../../middlewares/auth/security.middleware.js";
import { DISCOVER_LIMITS } from "../../constants/rateLimit.constant.js";

import {
  getDiscover,
  getOldDiscover,
} from "../controllers/user/discover/feed.controller.js";
import {
  leftSwipeProfile,
  rightSwipeProfile,
  rewindOldSwipe,
  getWhoRightSwipe,
} from "../controllers/user/discover/swipe.controller.js";
import { boostProfile } from "../controllers/user/discover/premium.controller.js";

const router = express.Router();

router.use(
  isLogin,
  findLoginData,
  isProfileExists,
  rateLimiter({
    limit: DISCOVER_LIMITS["discover:base"].maxRequests,
    window: DISCOVER_LIMITS["discover:base"].windowMinutes,
    block: DISCOVER_LIMITS["discover:base"].blockMinutes,
    route: "discover:base",
  }),
  checkPremiumStatus,
);

router.get("/", getDiscover);
router.get("/old", getOldDiscover);

router.post(
  "/pass/:username",
  isProfileBlocked,
  swipeProfile,
  leftSwipeProfile,
);

router.post(
  "/like/:username",
  isProfileBlocked,
  swipeProfile,
  rightSwipeProfile,
);

router.get("/likes", getWhoRightSwipe);
router.post(
  "/rewind/",
  rateLimiter({ limit: DISCOVER_LIMITS["discover:rewind"].maxRequests, window: DISCOVER_LIMITS["discover:rewind"].windowMinutes, block: DISCOVER_LIMITS["discover:rewind"].blockMinutes, route: "discover:rewind" }),
  rewindOldSwipe,
);
router.post(
  "/boost/",
  rateLimiter({ limit: DISCOVER_LIMITS["discover:boost"].maxRequests, window: DISCOVER_LIMITS["discover:boost"].windowMinutes, block: DISCOVER_LIMITS["discover:boost"].blockMinutes, route: "discover:boost" }),
  checkPacksStatus,
  boostProfile,
);

export default router;
