import express from "express";
import {
    isLogin,
    findLoginData
} from "../../middlewares/auth/auth.middleware.js";
import { isProfileExists } from "../../middlewares/user/profile.middleware.js";
import { validateChatAccess } from "../../middlewares/user/chat/chat.controller.js";
import { rateLimiter } from "../../middlewares/auth/security.middleware.js";
import { CHAT_LIMITS } from "../../constants/rateLimit.constant.js";

import {
    getChats,
    getSpecifyChatInfo
} from "../controllers/user/chat/inbox.controller.js";
import {
    getMessages,
    getSpecifyMessage,
    clearAllMessages,
    deleteAllMessages
} from "../controllers/user/chat/message/messages.controller.js";
import {
    togglePinChat,
    toggleMuteChat,
    toggleArchiveChat
} from "../controllers/user/chat/chatSettings.controller.js";
import { uploadChatMedia } from "../controllers/user/chat/chatUpload.controller.js";
import { syncChatInfos } from "../controllers/user/chat/sync.controller.js";

const router = express.Router();

router.use(
    isLogin,
    findLoginData,
    isProfileExists,
    rateLimiter({
        limit: CHAT_LIMITS["chat:base"].maxRequests,
        window: CHAT_LIMITS["chat:base"].windowMinutes,
        block: CHAT_LIMITS["chat:base"].blockMinutes,
        route: "chat:base"
    })
);

router.get("/", getChats);
router.get("/message/:messageId", getSpecifyMessage);
router.post("/sync", syncChatInfos);
router.post("/upload", uploadChatMedia);
router.get("/:chatId", getSpecifyChatInfo);

router.use("/:chatId", validateChatAccess);
router.delete("/:chatId", deleteAllMessages);
router.delete("/:chatId/clear", clearAllMessages);
router.get("/:chatId/messages", getMessages);

// settings
router.patch("/:chatId/pin", togglePinChat);
router.patch("/:chatId/mute", toggleMuteChat);
router.patch("/:chatId/archive", toggleArchiveChat);

export default router;
