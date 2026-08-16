import express from "express";
import {
  isLogin,
  findLoginData,
} from "../../middlewares/auth/auth.middleware.js";
import {
  optionalProfile,
  isProfileBlocked,
  isProfileExists,
} from "../../middlewares/user/profile.middleware.js";
import { optionalLogin } from "../../middlewares/auth/optional.middleware.js";
import {
  isPremiumUser,
  checkPremiumStatus,
} from "../../middlewares/user/premium.middleware.js";
import { rateLimiter } from "../../middlewares/auth/security.middleware.js";
import { PROFILE_LIMITS } from "../../constants/rateLimit.constant.js";

import { profileSetupHandler } from "../controllers/user/profile/setupProfile.controller.js";
import {
  loginProfileInfo,
  updateProfileInfo,
  changeProfileVisiblity,
  changeProfileIncognito,
  deleteProfile,
  restoreProfile,
  getProfileStats,
} from "../controllers/user/profile/loginProfile.controller.js";
import {
  uploadPhoto,
  getPhotos,
  deletePhoto,
  replacePrimaryPhoto,
} from "../controllers/user/profile/photo.controller.js";
import {
  viewPublicProfile,
  getWhoViewdMe,
} from "../controllers/user/profile/viewProfile.controller.js";
import {
  likePublicProfile,
  unlikePublicProfile,
  getWhoLikedProfile,
} from "../controllers/user/profile/likeProfile.controller.js";
import {
  blockUser,
  unblockUser,
  blockedUser,
} from "../controllers/user/profile/blockProfile.controller.js";
import {
  reportProfile,
  reportedProfiles,
} from "../controllers/user/profile/reportProfile.controller.js";
import {
  getIncomingTone,
  updateIncomingTone,
  resetIncomingTone,
  getRingBackTone,
  updateRingBackTone,
  resetRingBackTone,
} from "../controllers/user/profile/ringtone.controller.js";

const router = express.Router();

router.use(
  rateLimiter({
    limit: PROFILE_LIMITS["profile:base"].maxRequests,
    window: PROFILE_LIMITS["profile:base"].windowMinutes,
    block: PROFILE_LIMITS["profile:base"].blockMinutes,
    route: "profile:base",
  }),
);

router.use(
  /^(?!\/setup\/?$|\/public\/).*/,
  isLogin,
  findLoginData,
  isProfileExists,
);

router.post("/setup", isLogin, findLoginData, profileSetupHandler);
router
  .route("/me")
  .get(loginProfileInfo)
  .patch(updateProfileInfo)
  .delete(
    rateLimiter({
      limit: PROFILE_LIMITS["profile:delete"].maxRequests,
      window: PROFILE_LIMITS["profile:delete"].windowMinutes,
      block: PROFILE_LIMITS["profile:delete"].blockMinutes,
      route: "profile:delete",
    }),
    deleteProfile,
  );

router.use("/photo", checkPremiumStatus);
router
  .route("/photo")
  .get(getPhotos)
  .post(
    rateLimiter({
      limit: PROFILE_LIMITS["profile:photo:upload"].maxRequests,
      window: PROFILE_LIMITS["profile:photo:upload"].windowMinutes,
      block: PROFILE_LIMITS["profile:photo:upload"].blockMinutes,
      route: "profile:photo:upload",
    }),
    uploadPhoto,
  )
  .patch(
    rateLimiter({
      limit: PROFILE_LIMITS["profile:photo:replace"].maxRequests,
      window: PROFILE_LIMITS["profile:photo:replace"].windowMinutes,
      block: PROFILE_LIMITS["profile:photo:replace"].blockMinutes,
      route: "profile:photo:replace",
    }),
    replacePrimaryPhoto,
  );

router.delete(
  "/photo/:photoId",
  rateLimiter({
    limit: PROFILE_LIMITS["profile:photo:delete"].maxRequests,
    window: PROFILE_LIMITS["profile:photo:delete"].windowMinutes,
    block: PROFILE_LIMITS["profile:photo:delete"].blockMinutes,
    route: "profile:photo:delete",
  }),
  deletePhoto,
);

router.get("/views", checkPremiumStatus, getWhoViewdMe);

router.get(
  "/likes",
  rateLimiter({
    limit: PROFILE_LIMITS["profile:likes"].maxRequests,
    window: PROFILE_LIMITS["profile:likes"].windowMinutes,
    block: PROFILE_LIMITS["profile:likes"].blockMinutes,
    route: "profile:likes",
  }),
  checkPremiumStatus,
  getWhoLikedProfile,
);

router.get("/stats", getProfileStats);

router.patch("/visibility", changeProfileVisiblity);

router.patch("/incognito", checkPremiumStatus, changeProfileIncognito);

router.post(
  "/restore",
  rateLimiter({
    limit: PROFILE_LIMITS["profile:restore"].maxRequests,
    window: PROFILE_LIMITS["profile:restore"].windowMinutes,
    block: PROFILE_LIMITS["profile:restore"].blockMinutes,
    route: "profile:restore",
  }),
  restoreProfile,
);

router.get(
  "/public/:username",
  rateLimiter({
    limit: PROFILE_LIMITS["profile:public:view"].maxRequests,
    window: PROFILE_LIMITS["profile:public:view"].windowMinutes,
    block: PROFILE_LIMITS["profile:public:view"].blockMinutes,
    route: "profile:public:view",
  }),
  optionalLogin,
  optionalProfile,
  isProfileBlocked,
  viewPublicProfile,
);

router
  .route("/public/:username/like")
  .post(
    isLogin,
    findLoginData,
    isProfileExists,
    isProfileBlocked,
    rateLimiter({
      limit: PROFILE_LIMITS["profile:public:like"].maxRequests,
      window: PROFILE_LIMITS["profile:public:like"].windowMinutes,
      block: PROFILE_LIMITS["profile:public:like"].blockMinutes,
      route: "profile:public:like",
    }),
    likePublicProfile,
  )
  .delete(
    isLogin,
    findLoginData,
    isProfileExists,
    isProfileBlocked,
    rateLimiter({
      limit: PROFILE_LIMITS["profile:public:unlike"].maxRequests,
      window: PROFILE_LIMITS["profile:public:unlike"].windowMinutes,
      block: PROFILE_LIMITS["profile:public:unlike"].blockMinutes,
      route: "profile:public:unlike",
    }),
    unlikePublicProfile,
  );

router.get("/block", blockedUser);

router
  .route("/block/:username")
  .post(
    rateLimiter({
      limit: PROFILE_LIMITS["profile:block"].maxRequests,
      window: PROFILE_LIMITS["profile:block"].windowMinutes,
      block: PROFILE_LIMITS["profile:block"].blockMinutes,
      route: "profile:block",
    }),
    blockUser,
  )
  .delete(
    rateLimiter({
      limit: PROFILE_LIMITS["profile:unblock"].maxRequests,
      window: PROFILE_LIMITS["profile:unblock"].windowMinutes,
      block: PROFILE_LIMITS["profile:unblock"].blockMinutes,
      route: "profile:unblock",
    }),
    unblockUser,
  );

router.post(
  "/report/:username",
  isProfileBlocked,
  rateLimiter({
    limit: PROFILE_LIMITS["profile:report"].maxRequests,
    window: PROFILE_LIMITS["profile:report"].windowMinutes,
    block: PROFILE_LIMITS["profile:report"].blockMinutes,
    route: "profile:report",
  }),
  reportProfile,
);

router.get("/report/", reportedProfiles);

router
  .route("/ringtone/incoming/")
  .get(getIncomingTone)
  .patch(
    checkPremiumStatus,
    isPremiumUser(),
    rateLimiter({
      limit: PROFILE_LIMITS["profile:ringtone:incoming:update"].maxRequests,
      window: PROFILE_LIMITS["profile:ringtone:incoming:update"].windowMinutes,
      block: PROFILE_LIMITS["profile:ringtone:incoming:update"].blockMinutes,
      route: "profile:ringtone:incoming:update",
    }),
    updateIncomingTone,
  )
  .delete(
    checkPremiumStatus,
    isPremiumUser(),
    rateLimiter({
      limit: PROFILE_LIMITS["profile:ringtone:incoming:delete"].maxRequests,
      window: PROFILE_LIMITS["profile:ringtone:incoming:delete"].windowMinutes,
      block: PROFILE_LIMITS["profile:ringtone:incoming:delete"].blockMinutes,
      route: "profile:ringtone:incoming:delete",
    }),
    resetIncomingTone,
  );

router
  .route("/ringtone/ringback/")
  .get(getRingBackTone)
  .patch(
    checkPremiumStatus,
    isPremiumUser({
      gold: true,
    }),
    rateLimiter({
      limit: PROFILE_LIMITS["profile:ringtone:ringback:update"].maxRequests,
      window: PROFILE_LIMITS["profile:ringtone:ringback:update"].windowMinutes,
      block: PROFILE_LIMITS["profile:ringtone:ringback:update"].blockMinutes,
      route: "profile:ringtone:ringback:update",
    }),
    updateRingBackTone,
  )
  .delete(
    checkPremiumStatus,
    isPremiumUser({
      gold: true,
    }),
    rateLimiter({
      limit: PROFILE_LIMITS["profile:ringtone:ringback:delete"].maxRequests,
      window: PROFILE_LIMITS["profile:ringtone:ringback:delete"].windowMinutes,
      block: PROFILE_LIMITS["profile:ringtone:ringback:delete"].blockMinutes,
      route: "profile:ringtone:ringback:delete",
    }),
    resetRingBackTone,
  );

export default router;
