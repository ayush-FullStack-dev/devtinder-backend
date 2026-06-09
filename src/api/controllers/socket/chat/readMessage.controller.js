import Chat from "../.././../../models/Chat.model.js";
import Message from "../.././../../models/Message.model.js";

export const readMessage = (socket) => async (payload, ack) => {
  const { chatInfo } = socket.user;
  const chatId = chatInfo._id;

  const userId = socket.user.currentProfile._id;
  const mySetting = socket.user.chatInfo.settings.find(
    (u) => String(u.userId) === String(userId),
  );

  const readAt = new Date();

  const query = {
    chatId,
    senderId: { $ne: userId },
    "readBy.readAt": null,
  };

  if (mySetting.deletedAt) {
    query.createdAt = { $gt: mySetting.deletedAt };
  }

  const messages = await Message.find(query).select("_id");

  const updatedChatInfo = await Chat.findOneAndUpdate(
    {
      _id: chatId,
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
          "op.userId": userId,
          "op.unreadCount": { $gt: 0 },
        },
      ],
      returnDocument: "after",
    },
  );

  const messageIds = messages.map((k) => k._id);

  const updated = await Message.updateMany(
    {
      _id: { $in: messageIds },
    },
    {
      $set: {
        readBy: {
          userId,
          readAt,
        },
      },
    },
  );

  socket.to(`chat:${chatId}`).emit("chat:update", {
    type: "MESSAGE_READ",
    messageIds,
    senderId: userId,
    readAt,
  });

  const baseListInfo = {
    chatId,
    lastMessage: {
      type: updatedChatInfo.lastMessage.type,
      text: updatedChatInfo.lastMessage.text,
      senderId: updatedChatInfo.lastMessage.senderId,
      messageId: updatedChatInfo.lastMessage.messageId,
      sentAt: updatedChatInfo.lastMessage.sentAt,
    },
    lastMessageAt: updatedChatInfo.lastMessageAt,
    moveToTop: true,
  };

  socket.to(`user:${userId}`).emit("chat:list:update", {
    ...baseListInfo,
    unreadCount: updatedChatInfo.settings.find(
      (k) => String(k.userId) === String(userId),
    ).unreadCount,
  });

  return ack?.({
    success: true,
    messageIds,
    readAt,
    updatedCount: updated.modifiedCount,
  });
};

export const syncChatInfos = async (socket) => {
  const { currentProfile } = socket.user;
  const chatId = socket.data?.chatId;

  if (!chatId) {
    return ack?.({
      success: false,
      message: "ChatId is not intilized try again",
    });
  }

  const deliveredAt = new Date();

  const messages = await Message.find({
    chatId,
    senderId: { $ne: currentProfile._id },
    deletedForEveryoneAt: null,
    "deliveredTo.deliveredAt": null,
  }).select("_id");

  const messageIds = messages.map((k) => k._id);

  const delivered = await Message.updateMany(
    {
      _id: { $in: messageIds },
    },
    {
      $set: {
        deliveredTo: {
          userId: currentProfile._id,
          deliveredAt,
        },
      },
    },
  );

  socket.nsp.to(`chat:${chatId}`).emit("chat:update", {
    type: "MESSAGE_DELIVERED",
    messageIds,
    senderId: currentProfile._id,
    deliveredAt,
  });
};
