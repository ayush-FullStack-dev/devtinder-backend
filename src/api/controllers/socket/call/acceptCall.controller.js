import Call from "../.././../../models/Call.model.js";
import Profile from "../.././../../models/Profile.model.js";

import redis from "../.././../../config/redis.js";
import { endCall } from "./rejectCall.controller.js";
import { findPushSubscription } from "../../../../services/pushSubscription.service.js";
import { sendPush } from "../../../../notifications/sendNotification.js";

export const acceptCall =
  (socket) =>
  async ({ callId }, ack, ...args) => {
    const { currentProfile, chatInfo } = socket.user;

    const opponentId = chatInfo.settings.find(
      (k) => String(k.userId) !== String(currentProfile._id),
    ).userId;

    const call = await Call.findOneAndUpdate(
      {
        _id: callId,
        receiverId: currentProfile._id,
        chatId: chatInfo._id,
        status: { $in: ["ringing", "calling"] },
      },
      [
        {
          $set: {
            status: "ongoing",
            startedAt: new Date(),
            _flushedIce: "$iceBuffer",
            iceBuffer: [],
          },
        },
      ],
      { returnDocument: "after", updatePipeline: true },
    ).populate("callerId", "displayName primaryPhoto");

    if (!call) {
      return ack?.({
        success: false,
        code: "CALL_EXPIRED",
        message: "Call already handled on another device or expired",
        action: "CLOSE_SCREEN",
      });
    }

    const caller = call.callerId;

    if (!caller?._id) {
      return ack?.({
        success: false,
        code: "CALLER_NOT_AVAILABLE",
        message: "Caller is no longer available",
        action: "END_CALL",
        retry: false,
      });
    }

    const callRoom = `call:${call._id}`;
    const io = socket.nsp;
    socket.join(callRoom);
    io.in(`user:${caller._id}`).socketsJoin(callRoom);

    socket.nsp.to(`user:${caller._id}`).emit("call:accepted", {
      callId: call._id,
      chatId: call.chatId,
      receiver: {
        userId: currentProfile._id,
        name: currentProfile.displayName,
        photo: currentProfile.primaryPhoto.url,
      },
      caller: {
        userId: caller._id,
        name: caller.displayName,
        photo: caller.primaryPhoto.url,
      },
    });

    if (call._flushedIce?.length) {
      socket.nsp.to(callRoom).emit("call:signal", {
        type: "ice-batch",
        data: call._flushedIce,
      });
    }

    socket.to(`user:${currentProfile._id}`).emit("call:picked", {
      callId,
      picked: true,
    });

    socket.data = { ...socket.data, callId: call._id };

    await redis.hset(`call:${callId}`, {
      status: "ongoing",
      mute: "false",
      video: String(call.type === "video"),
      hold: "false",
      chatId: chatInfo._id.toString(),
    });
    await redis.expire(`call:${call._id}`, 3600);

    socket.to(`user:${caller._id}`).emit("call:notification:dismiss", {
      callId: call._id,
    });

    const pushInfos = await findPushSubscription(
      {
        profileId: opponentId,
      },
      {
        many: true,
      },
    );

    for (const fcm of pushInfos) {
      await sendPush(fcm.token, {
        notification: {
          title: "Call Picked",
        },
        data: {
          type: "call_ongoing",
          callId: call._id.toString(),
          chatId: chatInfo._id.toString(),
        },
        tag: `${currentProfile._id}-call`,
      });
    }

    if (args[0] === "server") {
      return {
        success: true,
        code: "CALL_ACCEPTED",
        message: "Call accepted",
        call: {
          callId: call._id,
          chatId: call.chatId,
          room: callRoom,
          role: "receiver",
        },
        startWebRTC: true,
      };
    }

    return ack?.({
      success: true,
      code: "CALL_ACCEPTED",
      message: "Call accepted",
      call: {
        callId: call._id,
        chatId: call.chatId,
        room: callRoom,
        role: "receiver",
      },
      startWebRTC: true,
    });
  };

export const switchCall =
  (socket) =>
  async ({ toCallId }, ack) => {
    const fromCallId = socket.data?.callId;

    const { currentProfile } = socket.user;

    const endCallHandler = endCall(socket);

    const isDeleted = await endCallHandler(
      {
        reason: "switched",
        callId: fromCallId,
      },
      () => {},
      "server",
    )?.success;

    if (!isDeleted) {
      return ack?.({
        success: false,
        code: "CALL_SWITCH_FAILED",
        message: "Unable to switch call. Previous call could not be ended.",
        action: "RESTORE_PREVIOUS_CALL",
        retry: true,
      });
    }

    const acceptCallHandler = acceptCall(socket);

    const call = await acceptCallHandler(
      {
        callId: toCallId,
      },
      () => {},
      "server",
    );

    if (!call?.success) {
      return ack?.({
        success: false,
        code: "CALL_SWITCH_FAILED",
        message: "Unable to switch call",
        action: "RESTORE_PREVIOUS_CALL",
      });
    }

    return ack?.(call);
  };
