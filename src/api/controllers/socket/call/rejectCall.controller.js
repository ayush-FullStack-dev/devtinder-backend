import Call from "../.././../../models/Call.model.js";
import Message from "../.././../../models/Message.model.js";
import Notification from "../.././../../models/Notification.model.js";

import {
  getMessagePayload,
  updateLastMessageCall,
} from "../../../../helpers/chat/message.helper.js";

import { getIO } from "../../../../../socket.js";
import { findPushSubscription } from "../../../../services/pushSubscription.service.js";
import { sendPush } from "../../../../notifications/sendNotification.js";
import redis from "../.././../../config/redis.js";

export const rejectCall =
  (socket) =>
  async ({ callId }, ack) => {
    const { currentProfile, chatInfo } = socket.user;
    const io = getIO();

    const call = await Call.findOneAndUpdate(
      {
        _id: callId,
        chatId: chatInfo._id,
        receiverId: currentProfile._id,
        status: { $in: ["ringing", "calling"] },
      },
      {
        status: "rejected",
        endedAt: new Date(),
        endReason: "rejected",
      },
      { returnDocument: "after" },
    );

    if (!call) {
      return ack?.({
        success: false,
        code: "CALL_NOT_FOUND",
        message: "Call not found or already ended",
      });
    }

    socket.nsp.to(`user:${call.callerId}`).emit("call:rejected", {
      callId,
      by: currentProfile._id,
    });

    const message = await Message.create({
      chatId: chatInfo._id,
      senderId: call.callerId,
      type: "system",
      system: {
        event: "call",
        call: {
          callId: call._id,
          type: call.type,
          callerId: call.callerId,
          status: "rejected",
        },
      },
      deliveredTo: {
        userId: currentProfile._id,
        deliveredAt: new Date(),
      },
    });

    const messagePayload = getMessagePayload(message, currentProfile);

    await redis.del(`call:${callId}`);

    io.of("/chat").to(`chat:${chatInfo._id}`).emit("chat:newMessage", {
      success: true,
      data: messagePayload,
    });

    await updateLastMessageCall(io, call.callerId, chatInfo._id, message);

    const callerSetting = chatInfo.settings.find(
      (u) => String(u.userId) === String(call.callerId),
    );

    socket.to(`user:${call.receiverId}`).emit("call:notification:dismiss", {
      callId: call._id,
    });

    const pushInfos = await findPushSubscription(
      {
        profileId: call.receiverId,
      },
      {
        many: true,
      },
    );

    for (const fcm of pushInfos) {
      await sendPush(fcm.token, {
        notification: {
          title: "Call Rejected",
        },
        data: {
          type: "call_rejected",
          callId: call._id.toString(),
          chatId: chatInfo._id.toString(),
        },
        tag: `${currentProfile._id}-call`,
      });
    }

    socket.data = { ...socket.data, callId: null };

    if (!callerSetting.muted) {
      await Notification.create({
        userId: call.callerId,
        type: "call_rejected",
        title: "Call Rejected",
        message: `${currentProfile.displayName} rejected your call`,
        data: {
          callId: call._id,
          chatId: chatInfo._id,
          by: "receiver",
        },
      });
    }

    return ack?.({
      success: true,
    });
  };

export const endCall =
  (socket) =>
  async (...args) => {
    const io = getIO();

    const { reason, callId } = args[0];

    const ack =
      typeof args[args.length - 1] === "function"
        ? args[args.length - 1]
        : null;

    const { currentProfile, chatInfo } = socket.user;

    const call = await Call.findOne({
      _id: callId,
      chatId: chatInfo._id,
      status: "ongoing",
    });

    if (!call) {
      return ack?.({
        success: false,
        code: "CALL_NOT_FOUND",
        message: "Call not found or already ended",
      });
    }

    const endTime = new Date();
    const startTime = new Date(call.startedAt);
    const durationInSeconds = Math.floor((endTime - startTime) / 1000);

    call.status = "ended";
    call.endedAt = endTime;
    call.duration = durationInSeconds;
    call.endReason = reason || "network";

    const res = await call.save();

    const callRoom = `call:${call._id}`;

    io.of("/call").to(callRoom).emit("call:ended", {
      callId: call._id,
      by: currentProfile._id,
      duration: durationInSeconds,
    });

    const message = await Message.create({
      chatId: chatInfo._id,
      senderId: call.callerId,
      type: "system",
      system: {
        event: "call",
        call: {
          callId: call._id,
          type: call.type,
          callerId: call.callerId,
          status: "ended",
          duration: durationInSeconds,
        },
      },
      deliveredTo: {
        userId: currentProfile._id,
        deliveredAt: new Date(),
      },
    });

    const messagePayload = getMessagePayload(message, currentProfile);

    await redis.del(`call:${callId}`);

    io.of("/chat").to(`chat:${chatInfo._id}`).emit("chat:newMessage", {
      success: true,
      data: messagePayload,
    });

    updateLastMessageCall(io, call.callerId, chatInfo._id, message);

    socket.data = { ...socket.data, callId: null };

    if (args[2] === "server") {
      return {
        success: true,
      };
    }

    return ack?.({
      success: true,
    });
  };

export const cancelCall =
  (socket) =>
  async ({ reason, callId }, ack) => {
    const { currentProfile, chatInfo } = socket.user;
    const io = getIO();

    const call = await Call.findOneAndUpdate(
      {
        _id: callId,
        callerId: currentProfile._id,
        chatId: chatInfo._id,
        status: { $in: ["calling", "ringing"] },
      },
      {
        status: "missed",
        endedAt: new Date(),
        endReason: reason || "hangup",
      },
      { returnDocument: "after" },
    );

    if (!call) {
      return ack?.({
        success: false,
        message: "Call not found or already processed",
      });
    }

    socket.nsp.to(`user:${call.receiverId}`).emit("call:cancelled", {
      callId,
      by: currentProfile._id,
    });

    const message = await Message.create({
      chatId: chatInfo._id,
      senderId: call.callerId,
      type: "system",
      system: {
        event: "call",
        call: {
          callId: call._id,
          type: call.type,
          callerId: call.callerId,
          status: "missed",
        },
      },
      deliveredTo: {
        userId: currentProfile._id,
        deliveredAt: new Date(),
      },
    });

    await redis.del(`call:${callId}`);

    const messagePayload = getMessagePayload(message, currentProfile);

    io.of("/chat").to(`chat:${chatInfo._id}`).emit("chat:newMessage", {
      success: true,
      data: messagePayload,
    });

    socket.to(`user:${call.receiverId}`).emit("call:notification:dismiss", {
      callId: call._id,
    });

    const pushInfos = await findPushSubscription(
      {
        profileId: call.receiverId,
      },
      {
        many: true,
      },
    );

    for (const fcm of pushInfos) {
      await sendPush(fcm.token, {
        notification: {
          title: "Call cancelled",
        },
        data: {
          type: "call_cancelled",
          callId: call._id.toString(),
          chatId: chatInfo._id.toString(),
        },
        tag: `${currentProfile._id}-call`,
      });
    }

    socket.data = { ...socket.data, callId: null };

    updateLastMessageCall(io, call.callerId, chatInfo._id, message);

    const receiverSetting = chatInfo.settings.find(
      (u) => String(u.userId) !== String(currentProfile._id),
    );

    if (!receiverSetting.muted) {
      await Notification.create({
        userId: call.receiverId,
        type: "call_missed",
        title: "Missed Call",
        message: `${currentProfile.displayName} tried to call you`,
        data: {
          callId: call._id,
          chatId: call.chatId,
        },
      });
    }

    return ack?.({
      success: true,
    });
  };
