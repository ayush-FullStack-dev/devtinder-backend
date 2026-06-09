import sendResponse from "../../../../../helpers/sendResponse.js";
import Message from "../../../../../models/Message.model.js";
import Chat from "../../../../../models/Chat.model.js";

import { paginationInfos } from "../../../../../helpers/pagination.helper.js";
import { buildSubscriptionInfo } from "../../../../../helpers/subscription/subscription.helper.js";
import { getMessagePayload } from "../../../../../helpers/chat/message.helper.js";
import { isValidDate } from "../../../../../helpers/time.js";

export const getMessages = async (req, res) => {
  const { currentProfile, chatInfo } = req.auth;

  const limit = Math.min(Number(req.query.limit) || 10, 50);

  const mySetting = chatInfo.settings.find(
    (u) => String(u.userId) === String(currentProfile._id),
  );

  const query = {
    chatId: chatInfo._id,
  };

  if (req.query?.cursor) {
    if (!isValidDate(req.query.cursor)) {
      return sendResponse(res, 400, {
        success: false,
        message: "Invalid cursor",
      });
    }
    query.createdAt = { $lt: new Date(req.query.cursor) };
  }

  if (mySetting.deletedAt) {
    query.createdAt = {
      ...query.createdAt,
      $gt: mySetting.deletedAt,
    };
  }

  const messages = await Message.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1);

  const { pagination, info: messagesInfo } = paginationInfos(
    messages,
    limit,
    "createdAt",
  );

  const response = {
    data: { chatId: chatInfo._id, messages: [] },
    pagination,
  };

  await Chat.findOneAndUpdate(
    {
      _id: chatInfo._id,
      status: "active",
    },
    {
      $set: {
        "settings.$[op].unreadCount": 0,
      },
    },
    {
      arrayFilters: [
        {
          "op.userId": currentProfile._id,
          "op.unreadCount": { $gt: 0 },
        },
      ],
      returnDocument: "after",
    },
  );

  for (const message of messagesInfo) {
    const isDeletedForMe = message.deletedFor.some(
      (d) => String(d.userId) === String(currentProfile._id),
    );

    if (isDeletedForMe) {
      continue;
    }

    const messagePayload = getMessagePayload(message, currentProfile);

    response.data.messages.push(messagePayload);
  }

  return sendResponse(res, 200, {
    message: response.data.messages.length
      ? "All messages fetched successfull"
      : "no message found",
    ...response,
  });
};

export const clearAllMessages = async (req, res) => {
  const { currentProfile, chatInfo } = req.auth;

  const updatedChat = await Chat.findByIdAndUpdate(
    chatInfo._id,
    {
      $set: {
        "settings.$[op].deletedAt": new Date(),
      },
    },
    {
      arrayFilters: [
        {
          "op.userId": currentProfile._id,
        },
      ],
      returnDocument: "after",
    },
  );

  return sendResponse(res, 200, {
    message: "Chat cleared successfully",
    data: {
      chatId: chatInfo._id,
      clearedAt: updatedChat.settings.find(
        (u) => String(u.userId) === String(currentProfile._id),
      ).deletedAt,
    },
  });
};

export const deleteAllMessages = async (req, res) => {
  const { user, currentProfile, chatInfo } = req.auth;
  const premium = buildSubscriptionInfo(currentProfile.premium);
  const isAdmin = user.role === "admin";
  const isGold = premium?.isActive && premium.tier === "gold";

  if (!isAdmin && !isGold) {
    return sendResponse(res, 403, {
      code: "FORBIDDEN",
      message: "Only admin or gold users can delete all messages",
    });
  }

  const result = await Message.deleteMany({ chatId: chatInfo._id });

  await Chat.findOneAndUpdate(chatInfo._id, {
    lastMessage: null,
    lastMessageAt: null,
  });

  return sendResponse(res, 200, {
    message: "All messages deleted successfully",
    data: {
      chatId: chatInfo._id,
      deletedCount: result.deletedCount,
    },
  });
};

export const getSpecifyMessage = async (req, res) => {
  const { currentProfile } = req.auth;
  const { messageId } = req.params;

  const message = await Message.findOne({
    _id: messageId,
  });

  const isDeletedForMe = message?.deletedFor?.some(
    (d) => String(d.userId) === String(currentProfile._id),
  );

  if (!message || isDeletedForMe) {
    return sendResponse(res, 404, {
      code: "MESSAGE_NOT_FOUND",
      message: "Message does not exist or you no longer have access",
    });
  }

  const chat = await Chat.findById(message.chatId);

  const mySetting = chat?.settings?.find(
    (u) => String(u.userId) === String(currentProfile._id),
  );

  if (!chat) {
    return sendResponse(res, 404, {
      code: "CHAT_NOT_FOUND",
      message: "Chat no longer exists",
    });
  }

  if (!mySetting) {
    return sendResponse(res, 404, {
      code: "MESSAGE_NOT_FOUND",
      message: "Message does not exist or you no longer have access",
    });
  }

  if (mySetting.deletedAt && mySetting.deletedAt < message.createdAt) {
    return sendResponse(res, 404, {
      code: "MESSAGE_NOT_FOUND",
      message: "Message does not exist or you no longer have access",
    });
  }

  const messageInfo = getMessagePayload(message, currentProfile);

  return sendResponse(res, 200, {
    message: "Message fetched successfully",
    data: {
      chatId: chat._id,
      ...messageInfo,
    },
  });
};
