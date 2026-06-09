import Message from "../.././../../models/Message.model.js";
import Chat from "../../../../models/Chat.model.js";

import { newMessageValidator } from "../../../../validators/user/chat/newMessage.validator.js";

import { prettyErrorResponse } from "../../../../helpers/ApiError.js";
import { getMessagePayload } from "../../../../helpers/chat/message.helper.js";
import { findPushSubscription } from "../../../../services/pushSubscription.service.js";
import { sendNotification } from "../../../../notifications/sendNotification.js";

export const sendRealTimeMessage = (socket) => async (payload, ack) => {
  const { currentProfile, chatInfo } = socket.user;
  const chatId = chatInfo._id;

  const validate = newMessageValidator.validate(payload);
  const value = validate?.value;

  if (validate?.error) {
    const jsonResponse = prettyErrorResponse(
      validate,
      "Invalid message payload",
    );
    return ack?.({
      success: false,
      code: "VALIDATION_ERROR",
      jsonResponse,
    });
  }

  const receiverSetting = chatInfo.settings.find(
    (k) => String(k.userId) !== String(currentProfile._id),
  );

  const opponentId = receiverSetting.userId;

  const isOnline = socket.adapter.rooms.has(`user:${opponentId}`);

  const message = await Message.create({
    chatId,
    senderId: socket.user.currentProfile._id,
    type: value.type,
    text: value.text,
    media: value.media?.key
      ? {
          key: value.media?.key,
          url: value.media?.url,
          mimeType: value.media?.mimeType,
          size: value.media?.size,
          name: value.media?.name,
          width: value.media?.width,
          height: value.media?.height,
          duration: value.media?.duration,
        }
      : null,
    forwarded: payload.forwarded?.originalMessageId
      ? {
          isForwarded: true,
          fromUserId: currentProfile._id,
          originalMessageId: payload.forwarded.originalMessageId,
        }
      : null,
    replyTo: value.replyTo,
    deliveredTo: isOnline
      ? {
          userId: chatInfo.users.find((n) => n !== currentProfile._id),
          deliveredAt: new Date(),
        }
      : null,
  });

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
      $inc: {
        "settings.$[op].unreadCount": 1,
      },
    },
    {
      arrayFilters: [{ "op.userId": opponentId }],
      returnDocument: "after",
    },
  );

  const messagePayload = getMessagePayload(message, currentProfile);

  const baseListInfo = {
    type: "MESSAGE_SEND",
    chatId,
    lastMessage: {
      type: updatedChatInfo.lastMessage.type,
      text: updatedChatInfo.lastMessage.text,
      senderId: updatedChatInfo.lastMessage.senderId,
      messageId: updatedChatInfo.lastMessage.messageId,
      sentAt: updatedChatInfo.lastMessage.sentAt,
      status: messagePayload.status,
    },
    lastMessageAt: updatedChatInfo.lastMessageAt,
    moveToTop: true,
  };

  socket.to(`user:${opponentId}`).emit("chat:list:update", {
    ...baseListInfo,
    unreadCount: updatedChatInfo.settings.find(
      (k) => String(k.userId) !== String(currentProfile._id),
    ).unreadCount,
    sender: "opponent",
  });

  socket.nsp.to(`user:${currentProfile._id}`).emit("chat:list:update", {
    ...baseListInfo,
    unreadCount: updatedChatInfo.settings.find(
      (k) => String(k.userId) === String(currentProfile._id),
    ).unreadCount,
    sender: "me",
  });

  socket.to(`chat:${chatId}`).emit("chat:newMessage", {
    success: true,
    data: messagePayload,
  });

  socket.emit("chat:messageSent", {
    success: true,
    data: messagePayload,
  });

  if (!receiverSetting.muted) {
    const pushInfos = await findPushSubscription(
      {
        profileId: opponentId,
      },
      {
        many: true,
      },
    );

    for (const fcm of pushInfos) {
      await sendNotification(fcm, {
        type: "MESSAGE_SEND",
        title: `${currentProfile.displayName}`,
        body: `${message.type === "text" ? message.text : message.type === "media" ? message.media.url : "system"}`,
        message: {
          id: message._id,
          type: message.type,
          text: message.text,
          media: message.media.url,
        },
        tag: `${currentProfile._id}-message`,
        url: `${process.extra.DOMAIN_LINK}/chat/${chatId}`,
        renotify: true,
      });
    }
  }

  return ack?.({ success: true, message: "Message sent" });
};
