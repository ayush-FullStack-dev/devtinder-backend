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
    limit: 50,
    window: 2,
    block: 5,
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
  rateLimiter({ limit: 15, window: 5, block: 10, route: "discover:rewind" }),
  rewindOldSwipe,
);
router.post(
  "/boost/",
  rateLimiter({ limit: 5, window: 10, block: 30, route: "discover:boost" }),
  checkPacksStatus,
  boostProfile,
);

export default router;
