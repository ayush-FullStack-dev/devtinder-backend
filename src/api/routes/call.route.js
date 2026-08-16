import express from "express";
import {
    isLogin,
    findLoginData
} from "../../middlewares/auth/auth.middleware.js";
import { isProfileExists } from "../../middlewares/user/profile.middleware.js";
import { validateChatAccess } from "../../middlewares/user/chat/chat.controller.js";
import { rateLimiter } from "../../middlewares/auth/security.middleware.js";
import { CALL_LIMITS } from "../../constants/rateLimit.constant.js";

import {
    getCalls,
    getSpecifyCall
} from "../controllers/user/call/call.controller.js";
import {
    deleteCallLogs,
    deleteSpecifyCall
} from "../controllers/user/call/history.controller.js";

const router = express.Router();

router.use(
    isLogin,
    findLoginData,
    isProfileExists,
    rateLimiter({
        limit: CALL_LIMITS["call:base"].maxRequests,
        window: CALL_LIMITS["call:base"].windowMinutes,
        block: CALL_LIMITS["call:base"].blockMinutes,
        route: "call:base"
    })
);

router.route("/").get(getCalls).delete(deleteCallLogs);
router.route("/:callId").get(getSpecifyCall).delete(deleteSpecifyCall)

export default router;
