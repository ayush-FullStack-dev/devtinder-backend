import mongoose from "mongoose";

import Message from "../.././../../models/Message.model.js";
import Chat from "../.././../../models/Chat.model.js";

import { deleteS3Key } from "../../../../helpers/s3.helper.js";
import { findPushSubscription } from "../../../../services/pushSubscription.service.js";
import { sendNotification } from "../../../../notifications/sendNotification.js";

export const deleteRealTimeMessage =
  (socket) =>
  async ({ messageId, mode }, ack) => {
    const { currentProfile, chatInfo } = socket.user;
    const mySetting = chatInfo.settings.find(
      (u) => String(u.userId) === String(currentProfile._id),
    );

    const chatId = chatInfo._id;

    const allowedModes = ["me", "everyone"];

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return ack?.({
        success: false,
        code: "INVALID_MESSAGE_ID",
        message: "Invalid message id format",
      });
    }

    if (!allowedModes.includes(mode)) {
      return ack?.({
        success: false,
        code: "INVALID_DELETE_MODE",
        message: "Delete mode must be 'me' or 'everyone'",
      });
    }

    const receiverSetting = chatInfo.settings.find(
      (k) => String(k.userId) !== String(currentProfile._id),
    );

    const opponentId = receiverSetting.userId;

    const query = {
      _id: messageId,
      chatId,
    };

    if (mySetting.deletedAt) {
      query.createdAt = { $gt: mySetting.deletedAt };
    }

    const message = await Message.findOne(query);

    if (!message) {
      return ack?.({
        success: false,
        code: "NOT_FOUND",
        message: "Message not found",
      });
    }

    const isAlreadyDeleted =
      !!message.deletedFor.some(
        (u) => String(u.userId) === String(currentProfile._id),
      ) || message.deletedForEveryoneAt;

    if (isAlreadyDeleted) {
      return ack?.({
        success: false,
        code: "MESSAGE_ALREADY_DELETED",
        message: message.deletedForEveryoneAt
          ? "This message was already deleted for everyone"
          : "You have already deleted this message",
        status: 409,
      });
    }

    const isLastMessage =
      String(chatInfo.lastMessage.messageId) === String(message._id);

    if (
      (mode === "everyone" &&
        String(message.senderId) !== String(currentProfile._id)) ||
      message.type === "system"
    ) {
      return ack?.({
        success: false,
        code: "DELETE_NOT_ALLOWED",
        message: "You can delete this message only for yourself",
        action: "USE_DELETE_FOR_ME",
        status: 403,
      });
    }

    const updatePayload =
      mode === "everyone"
        ? {
            text: null,
            media: null,
            deletedForEveryoneAt: new Date(),
          }
        : {
            $push: {
              deletedFor: {
                userId: currentProfile._id,
                deletedAt: new Date(),
              },
            },
          };

    if (mode === "everyone" && message.type !== "text" && message.media?.key) {
      await deleteS3Key(message.media.key);
    }

    if (mode === "me" && isLastMessage) {
      const secondLastMessage = await Message.findOne({
        _id: { $ne: message._id },
        chatId,
        deletedFor: {
          $not: {
            $elemMatch: { userId: currentProfile._id },
          },
        },
      }).sort({ createdAt: -1 });

      if (!secondLastMessage) {
        socket.to(`user:${currentProfile._id}`).emit("chat:list:update", {
          type: "MESSAGE_DELETED_ME",
          chatId,
          lastMessage: null,
          lastMessageAt: null,
          moveToTop: true,
        });
      } else {
        socket.to(`user:${currentProfile._id}`).emit("chat:list:update", {
          type: "MESSAGE_DELETED_ME",
          chatId,
          lastMessage: {
            type: secondLastMessage.type,
            text: secondLastMessage.text,
            senderId: secondLastMessage.senderId,
            messageId: secondLastMessage._id,
            sentAt: secondLastMessage.createdAt,
          },
          lastMessageAt: secondLastMessage.createdAt,
          moveToTop: true,
        });
      }
    }

    if (mode === "everyone" && isLastMessage) {
      await Chat.findByIdAndUpdate(
        chatInfo._id,
        {
          lastMessage: null,
          lastMessageAt: null,
        },
        {
          returnDocument: "after",
        },
      );

      const baseListInfo = {
        type: "MESSAGE_DELETED",
        chatId,
        lastMessage: {
          type: null,
          text: null,
          senderId: null,
          messageId: null,
          sentAt: null,
          status: null,
        },
        lastMessageAt: null,
        moveToTop: true,
      };

      socket.to(`user:${opponentId}`).emit("chat:list:update", {
        ...baseListInfo,
        sender: "opponent",
      });

      socket.to(`user:${currentProfile._id}`).emit("chat:list:update", {
        ...baseListInfo,
        sender: "me",
      });
    }

    await Message.findByIdAndUpdate(message._id, updatePayload, {
      returnDocument: "after",
    });

    const payload = {
      type: "MESSAGE_DELETED",
      messageId: message._id,
      deleterId: currentProfile._id,
      mode,
    };

    socket.nsp.to(`chat:${chatId}`).emit("chat:message:update", payload);

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
          type: "MESSAGE_DELETED",
          title: "message deleted",
          body: "This message is no longer valid",
          tag: `${currentProfile._id}-message`,
          silent: true,
        });
      }
    }

    return ack?.({
      success: true,
      message: "Message deleted",
    });
  };
