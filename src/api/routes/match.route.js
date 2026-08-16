import express from "express";
import {
    isLogin,
    findLoginData
} from "../../middlewares/auth/auth.middleware.js";
import { isProfileExists } from "../../middlewares/user/profile.middleware.js";
import {
    isPremiumUser,
    checkPremiumStatus
} from "../../middlewares/user/premium.middleware.js";

import { rateLimiter } from "../../middlewares/auth/security.middleware.js";
import { MATCH_LIMITS } from "../../constants/rateLimit.constant.js";

import {
    getMatched,
    getSpecificMatch
} from "../controllers/user/match/viewMatch.controller.js";
import {
    revokeMatch,
    deactivatedMatches,
    restoreMatch
} from "../controllers/user/match/deleteMatch.controller.js";

const router = express.Router();

router.use(
    isLogin,
    findLoginData,
    isProfileExists,
    rateLimiter({
        limit: MATCH_LIMITS["match:base"].maxRequests,
        window: MATCH_LIMITS["match:base"].windowMinutes,
        block: MATCH_LIMITS["match:base"].blockMinutes,
        route: "match:base"
    }),
    checkPremiumStatus
);

router.get("/restore/", deactivatedMatches);

router.get(
    "/",
    rateLimiter({
        limit: MATCH_LIMITS["match:list"].maxRequests,
        window: MATCH_LIMITS["match:list"].windowMinutes,
        block: MATCH_LIMITS["match:list"].blockMinutes,
        route: "match:list"
    }),
    getMatched
);

router
    .route("/:matchId")
    .get(
        rateLimiter({
            limit: MATCH_LIMITS["match:detail"].maxRequests,
            window: MATCH_LIMITS["match:detail"].windowMinutes,
            block: MATCH_LIMITS["match:detail"].blockMinutes,
            route: "match:detail"
        }),
        getSpecificMatch
    )
    .delete(
        rateLimiter({
            limit: MATCH_LIMITS["match:revoke"].maxRequests,
            window: MATCH_LIMITS["match:revoke"].windowMinutes,
            block: MATCH_LIMITS["match:revoke"].blockMinutes,
            route: "match:revoke"
        }),
        revokeMatch
    );

router.post(
    "/restore/:matchId",
    rateLimiter({
        limit: MATCH_LIMITS["match:restore"].maxRequests,
        window: MATCH_LIMITS["match:restore"].windowMinutes,
        block: MATCH_LIMITS["match:restore"].blockMinutes,
        route: "match:restore"
    }),
    isPremiumUser(),
    restoreMatch
);

export default router;
