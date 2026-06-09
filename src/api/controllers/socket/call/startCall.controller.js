import Chat from "../.././../../models/Chat.model.js";
import Call from "../.././../../models/Call.model.js";
import Message from "../.././../../models/Message.model.js";
import Profile from "../.././../../models/Profile.model.js";
import Notification from "../.././../../models/Notification.model.js";

import { ringtone, busy } from "../../../../constants/call.constant.js";
import { buildSubscriptionInfo } from "../../../../helpers/subscription/subscription.helper.js";
import {
  getMessagePayload,
  updateLastMessageCall,
} from "../../../../helpers/chat/message.helper.js";
import { findPushSubscription } from "../../../../services/pushSubscription.service.js";
import { sendPush } from "../../../../notifications/sendNotification.js";
import redis from "../.././../../config/redis.js";
import { getIO } from "../../../../../socket.js";

const cleanupHandler = (socket, callId, isOnline) => async () => {
  const { currentProfile, chatInfo } = socket.user;
  const io = getIO();

  const updatedCall = await Call.findOneAndUpdate(
    {
      _id: callId,
      status: {
        $in: ["calling", "ringing"],
      },
    },
    {
      status: "missed",
      endedAt: new Date(),
      endReason: "missed",
    },
    { returnDocument: "after" },
  );

  if (!updatedCall) {
    return;
  }

  await redis.del(`call:${callId}`);

  socket.to(`user:${updatedCall.receiverId}`).emit("call:missed", {
    callId,
  });

  socket.nsp.to(`user:${updatedCall.callerId}`).emit("call:missed", {
    callId,
  });

  const message = await Message.create({
    chatId: updatedCall.chatId,
    senderId: updatedCall.callerId,
    type: "system",
    system: {
      event: "call",
      call: {
        callId,
        type: updatedCall.type,
        callerId: updatedCall.callerId,
        status: "missed",
      },
    },
    deliveredTo: isOnline
      ? {
          userId: updatedCall.receiverId,
          deliveredAt: new Date(),
        }
      : null,
  });

  const receiverSetting = chatInfo.settings.find(
    (u) => String(u.userId) === String(updatedCall.receiverId),
  );

  if (!receiverSetting.muted) {
    await Notification.create({
      userId: updatedCall.receiverId,
      type: "call_missed",
      title: "Missed Call",
      message: `${currentProfile.displayName} tried to call you`,
      data: {
        callId: updatedCall._id,
        chatId: updatedCall.chatId,
      },
    });
  }

  socket
    .to(`user:${updatedCall.receiverId}`)
    .emit("call:notification:dismiss", {
      callId: updatedCall._id,
    });

  const pushInfos = await findPushSubscription(
    {
      profileId: updatedCall.receiverId,
    },
    {
      many: true,
    },
  );

  for (const fcm of pushInfos) {
    await sendPush(fcm.token, {
      notification: {
        title: "Missed Call",
      },
      data: {
        type: "call_missed",
        callId: updatedCall._id.toString(),
        chatId: chatInfo._id.toString(),
      },
      tag: `${currentProfile._id}-call`,
    });
  }

  socket.data = { ...socket.data, callId: null };

  const messagePayload = getMessagePayload(message, updatedCall.callerId);

  io.of("/chat").to(`chat:${updatedCall.chatId}`).emit("chat:newMessage", {
    success: true,
    data: messagePayload,
  });

  await updateLastMessageCall(
    io,
    updatedCall.callerId,
    updatedCall.chatId,
    message,
  );
};

export const startCall = async ({ callType, socket }, ack) => {
  const { user, currentProfile, chatInfo } = socket.user;
  const chatId = chatInfo._id;

  if (!chatId) {
    return ack?.({
      success: false,
      message: "Chat id is not intilized try again",
    });
  }

  const opponentId = chatInfo.users.find(
    (k) => String(k) !== String(currentProfile._id),
  );

  const ongoingCall = await Call.countDocuments({
    $or: [{ callerId: opponentId }, { receiverId: opponentId }],
    status: "ongoing",
  });

  const isBusy = ongoingCall >= 1;
  let incomingTone = busy.incoming;
  let rinbackTone = busy.ringBack;

  if (!isBusy) {
    const receiverProfile = await Profile.findById(opponentId);

    if (!receiverProfile) {
      return ack?.({
        success: false,
        code: "RECEIVER_NOT_AVAILABLE",
        message: "Receiver is no longer available",
        action: "END_CALL",
        retry: false,
      });
    }
    const isPremium = buildSubscriptionInfo(receiverProfile.premium).isActive;

    incomingTone =
      isPremium && receiverProfile.premium.features.ringtone?.incoming?.enabled
        ? receiverProfile.premium.features.ringtone.incoming?.url
        : ringtone.incoming;

    rinbackTone =
      isPremium && receiverProfile.premium.features.ringtone?.ringback?.enabled
        ? receiverProfile.premium.features.ringtone.ringback?.url
        : ringtone.ringBack;
  }

  const isOnline = socket.adapter.rooms.has(`user:${opponentId}`);

  const call = await Call.create({
    chatId,
    callerId: currentProfile._id,
    receiverId: opponentId,
    type: callType,
    status: isOnline ? "ringing" : "calling",
  });

  socket.to(`user:${opponentId}`).emit("call:incoming", {
    callId: call._id,
    chatId,
    type: call.type,
    caller: {
      userId: currentProfile._id,
      name: currentProfile.displayName,
      photo: currentProfile.primaryPhoto.url,
    },
    isBusy,
    incomingTone,
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
        title: "Incoming Call",
        body: `${currentProfile.displayName} is calling you`,
      },
      data: {
        type: "call_incoming",
        callId: call._id.toString(),
        chatId: chatId.toString(),
        photo: currentProfile.primaryPhoto.url,
        callerName: currentProfile.displayName,
        callType: call.type,
      },
      tag: `${currentProfile._id}-call`,
    });
  }

  socket.data = { ...socket.data, callId: call._id };

  setTimeout(
    cleanupHandler(socket, call._id, isOnline),
    isBusy ? 15000 : 60000,
  );

  return ack?.({
    success: true,
    call: {
      callId: call._id,
      status: call.status,
      type: call.type,
      rinbackTone,
      isBusy,
      timeout: isBusy ? 15 : 60,
    },
  });
};

export const startVoiceCall =
  (socket) =>
  async ({ chatId }, ack) => {
    return startCall({ callType: "voice", socket, chatId }, ack);
  };

export const startVideoCall =
  (socket) =>
  async ({ chatId }, ack) => {
    return startCall({ callType: "video", socket, chatId }, ack);
  };
