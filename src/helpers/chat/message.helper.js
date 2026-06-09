import Chat from "../../models/Chat.model.js";

export const getMessageStatus = (isDeletedForEveryone, readBy, deliveredTo) => {
  return isDeletedForEveryone
    ? "deleted"
    : readBy.readAt
      ? "read"
      : deliveredTo.deliveredAt
        ? "delivered"
        : "sent";
};

export const getReaction = (reactions, myId) => {
  const reactionMap = {};

  reactions.forEach((r) => {
    if (!reactionMap[r.emoji]) {
      reactionMap[r.emoji] = {
        emoji: r.emoji,
        count: 0,
        reactedByMe: false,
        users: [],
      };
    }

    r.users.forEach((userId) => {
      reactionMap[r.emoji].count += 1;

      const isMe = String(userId) === String(myId);

      if (isMe) reactionMap[r.emoji].reactedByMe = true;

      reactionMap[r.emoji].users.push({
        userId,
        role: isMe ? "me" : "opponent",
      });
    });
  });

  return reactionMap;
};

export const getMessagePayload = (message, currentProfile) => {
  const sender =
    String(message.senderId) === String(currentProfile._id) ? "me" : "opponent";

  const isDeletedForEveryone = !!message.deletedForEveryoneAt;

  const response = {
    messageId: message._id,
    type: message.type,
    text: message.text,
    sender,
    senderId: message.senderId,
    media:
      !isDeletedForEveryone && message.media.url
        ? {
            url: message.media.url,
            key: message.media.key,
            mimeType: message.media.mimeType,
            size: message.media.size,
            duration: message.media.duration,
            width: message.media.width,
            height: message.media.height,
          }
        : {
            url: null,
            key: null,
            mimeType: null,
            size: null,
            duration: null,
            width: null,
            height: null,
          },

    replyTo: message.replyTo,

    forwarded: {
      isForwarded: message.forwarded.isForwarded,
      fromUserId: message.forwarded.fromUserId,
      originalMessageId: message.forwarded.originalMessageId,
    },

    edited: !!message.editedAt,
    editedAt: message.editedAt,

    reactions: getReaction(message.reactions, currentProfile._id),

    deleted: {
      forEveryone: isDeletedForEveryone,
    },

    timestamps: {
      sentAt: message.createdAt,
      deliveredAt: message.deliveredTo.deliveredAt,
      readAt: message.readBy.readAt,
    },

    status: getMessageStatus(
      isDeletedForEveryone,
      message.readBy,
      message.deliveredTo,
    ),
  };

  if (message.type === "system") {
    if (message.system.event === "call") {
      const call = message.system.call;

      const direction =
        String(call.callerId) === String(currentProfile._id)
          ? "outgoing"
          : "incoming";

      response.sender = "system";
      response.system = {
        event: message.system.event,
        call: {
          callId: call.callId,
          type: call.type,
          callerId: call.callerId,
          status: call.status,
          duration: call.duration,
          direction,
        },
      };
    }
  }

  return response;
};

export const updateLastMessageCall = async (
  io,
  opponentId,
  chatId,
  message,
) => {
  const updatedChatInfo = await Chat.findByIdAndUpdate(
    chatId,
    {
      $set: {
        lastMessage: {
          type: message.type,
          text: message.text,
          senderId: message.senderId,
          messageId: message._id,
          sentAt: message.createdAt,
        },
        lastMessageAt: new Date(),
      },
    },
    {
      returnDocument: "after",
    },
  );

  io.of("/chat")
    .to(`user:${opponentId}`)
    .emit("chat:list:update", {
      type: "CALL_SEND",
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
    });
};
