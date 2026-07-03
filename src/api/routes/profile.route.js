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
    limit: 120,
    window: 5,
    block: 5,
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
      limit: 3,
      window: 60,
      block: 30,
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
      limit: 20,
      window: 5,
      block: 5,
      route: "profile:photo:upload",
    }),
    uploadPhoto,
  )
  .patch(
    rateLimiter({
      limit: 10,
      window: 5,
      block: 5,
      route: "profile:photo:replace",
    }),
    replacePrimaryPhoto,
  );

router.delete(
  "/photo/:photoId",
  rateLimiter({
    limit: 20,
    window: 5,
    block: 5,
    route: "profile:photo:delete",
  }),
  deletePhoto,
);

router.get("/views", checkPremiumStatus, getWhoViewdMe);

router.get(
  "/likes",
  rateLimiter({
    limit: 20,
    window: 5,
    block: 5,
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
    limit: 3,
    window: 60,
    block: 30,
    route: "profile:restore",
  }),
  restoreProfile,
);

router.get(
  "/public/:username",
  rateLimiter({
    limit: 100,
    window: 5,
    block: 5,
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
      limit: 50,
      window: 2,
      block: 5,
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
      limit: 50,
      window: 2,
      block: 5,
      route: "profile:public:unlike",
    }),
    unlikePublicProfile,
  );

router.get("/block", blockedUser);

router
  .route("/block/:username")
  .post(
    rateLimiter({
      limit: 5,
      window: 5,
      block: 2,
      route: "profile:block",
    }),
    blockUser,
  )
  .delete(
    rateLimiter({
      limit: 5,
      window: 5,
      block: 2,
      route: "profile:unblock",
    }),
    unblockUser,
  );

router.post(
  "/report/:username",
  isProfileBlocked,
  rateLimiter({
    limit: 3,
    window: 5,
    block: 5,
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
      limit: 20,
      window: 5,
      block: 5,
      route: "profile:ringtone:incoming:update",
    }),
    updateIncomingTone,
  )
  .delete(
    checkPremiumStatus,
    isPremiumUser(),
    rateLimiter({
      limit: 20,
      window: 5,
      block: 5,
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
      limit: 10,
      window: 5,
      block: 10,
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
      limit: 10,
      window: 5,
      block: 10,
      route: "profile:ringtone:ringback:delete",
    }),
    resetRingBackTone,
  );

export default router;
