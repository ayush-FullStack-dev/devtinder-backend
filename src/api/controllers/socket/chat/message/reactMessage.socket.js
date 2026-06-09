import Message from "../.././../../../models/Message.model.js";
import { prettyErrorResponse } from "../../../../../helpers/ApiError.js";
import {
  reactionValidator,
  unreactValidator,
} from "../../../../../validators/user/chat/reactMessage.validator.js";
import { getReaction } from "../../../../../helpers/chat/message.helper.js";
import { buildSubscriptionInfo } from "../../../../../helpers/subscription/subscription.helper.js";
import { findPushSubscription } from "../../../../../services/pushSubscription.service.js";
import { sendNotification } from "../../../../../notifications/sendNotification.js";

export const reactToMessage = (socket) => async (payload, ack) => {
  const { currentProfile, chatInfo } = socket.user;
  const chatId = socket.data?.chatId;

  const validate = reactionValidator.validate(payload);
  if (validate?.error) {
    return ack?.({
      success: false,
      code: "VALIDATION_ERROR",
      jsonResponse: prettyErrorResponse(validate, "Invalid reaction payload"),
    });
  }

  const { messageId, emoji } = validate.value;

  const premium = buildSubscriptionInfo(currentProfile.premium);

  const mySetting = chatInfo.settings.find(
    (u) => String(u.userId) === String(currentProfile._id),
  );

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

  const userReactionCount = message.reactions.reduce(
    (c, r) => c + r.users.some((u) => String(u) === String(currentProfile._id)),
    0,
  );

  const limit = premium.isActive ? 3 : 1;

  if (userReactionCount >= limit) {
    return ack?.({
      success: false,
      code: "REACTION_LIMIT_REACHED",
      limit: { current: userReactionCount, allowed: limit },
      requiredTier: premium.isActive ? undefined : ["silver", "gold"],
      action: premium.isActive ? undefined : "UPGRADE_PREMIUM",
    });
  }

  const receiverSetting = chatInfo.settings.find(
    (k) => String(k.userId) !== String(currentProfile._id),
  );

  const opponentId = receiverSetting.userId;

  const updated = await Message.findOneAndUpdate(
    {
      _id: messageId,
      chatId,
      "reactions.emoji": emoji,
      "reactions.users": { $ne: currentProfile._id },
    },
    {
      $addToSet: { "reactions.$.users": currentProfile._id },
    },
    { returnDocument: "after" },
  );

  const finalMessage =
    updated ??
    (await Message.findOneAndUpdate(
      { _id: messageId, chatId },
      {
        $push: {
          reactions: {
            emoji,
            users: [currentProfile._id],
          },
        },
      },
      { returnDocument: "after" },
    ));

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
        type: "MESSAGE_REACTED",
        title: `${currentProfile.displayName}`,
        body: `Reacted ${value.emoji} to "${message.type === "text" ? message.text : message.type === "system" || !message.media?.key ? "system" : message.media.url}"`,
        tag: `${currentProfile._id}-message`,
        silent: true,
      });
    }
  }

  socket.nsp.to(`chat:${chatId}`).emit("chat:message:update", {
    type: "MESSAGE_REACTED",
    messageId,
    reaction: getReaction(finalMessage.reactions, currentProfile._id),
  });
};

export const unreactToMessage = (socket) => async (payload, ack) => {
  const { currentProfile, chatInfo } = socket.user;
  const chatId = socket.data?.chatId;

  const validate = unreactValidator.validate(payload);

  if (validate?.error) {
    return ack?.({
      success: false,
      code: "VALIDATION_ERROR",
      jsonResponse: prettyErrorResponse(validate, "Invalid reaction payload"),
    });
  }

  const { messageId, emoji } = validate.value;
  const mySetting = chatInfo.settings.find(
    (u) => String(u.userId) === String(currentProfile._id),
  );
  const receiverSetting = chatInfo.settings.find(
    (k) => String(k.userId) !== String(currentProfile._id),
  );

  const opponentId = receiverSetting.userId;

  const message = await Message.findOne({
    _id: messageId,
    chatId,
    "reactions.users": currentProfile._id,
    createdAt: {
      $gt: mySetting.deletedAt,
    },
  });

  if (!message) {
    return ack?.({
      success: false,
      code: "REACTION_NOT_FOUND",
      message: "You haven't reacted to this message yet",
    });
  }

  const userReactions = message.reactions.filter((r) =>
    r.users.some((u) => String(u) === String(currentProfile._id)),
  );

  if (userReactions.length > 1 && !emoji) {
    return ack?.({
      success: false,
      code: "EMOJI_REQUIRED",
      required: ["emoji"],
    });
  }

  const targetEmojis = emoji ? [emoji] : userReactions.map((r) => r.emoji);

  await Message.updateOne(
    { _id: messageId, chatId },
    {
      $pull: {
        "reactions.$[r].users": currentProfile._id,
      },
    },
    {
      arrayFilters: [{ "r.emoji": { $in: targetEmojis } }],
    },
  );

  await Message.updateOne(
    { _id: messageId, chatId },
    {
      $pull: {
        reactions: { users: { $size: 0 } },
      },
    },
  );

  const updated = await Message.findById(messageId);

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
        type: "MESSAGE_UNREACTED",
        title: "message unreact",
        body: "This message is unreact by user",
        tag: `${currentProfile._id}-message`,
        silent: true,
      });
    }
  }

  socket.nsp.to(`chat:${chatId}`).emit("chat:message:update", {
    type: "MESSAGE_UNREACTED",
    messageId,
    reaction: getReaction(updated.reactions, currentProfile._id),
  });
};
