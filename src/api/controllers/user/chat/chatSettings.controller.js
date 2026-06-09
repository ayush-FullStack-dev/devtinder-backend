import sendResponse from "../../../../helpers/sendResponse.js";
import Chat from "../../../../models/Chat.model.js";

export const togglePinChat = async (req, res) => {
  const { currentProfile, chatInfo } = req.auth;

  const settingIndex = chatInfo.settings.findIndex(
    (u) => String(u.userId) === String(currentProfile._id),
  );

  const nextPin = chatInfo.settings[settingIndex].pinned ? false : true;
  chatInfo.settings[settingIndex].pinned = nextPin;

  await Chat.findByIdAndUpdate(
    chatInfo._id,
    {
      $set: {
        settings: chatInfo.settings,
      },
    },
    { returnDocument: "after" },
  );

  return sendResponse(res, 200, {
    message: "Chat pin status updated",
    data: {
      chatId: chatInfo._id,
      pinned: nextPin,
    },
  });
};

export const toggleMuteChat = async (req, res) => {
  const { currentProfile, chatInfo } = req.auth;

  const settingIndex = chatInfo.settings.findIndex(
    (u) => String(u.userId) === String(currentProfile._id),
  );

  const nextMute = chatInfo.settings[settingIndex].muted ? false : true;
  chatInfo.settings[settingIndex].muted = nextMute;

  await Chat.findByIdAndUpdate(
    chatInfo._id,
    {
      $set: {
        settings: chatInfo.settings,
      },
    },
    { returnDocument: "after" },
  );

  return sendResponse(res, 200, {
    message: "Chat mute status updated",
    data: {
      chatId: chatInfo._id,
      muted: nextMute,
    },
  });
};

export const toggleArchiveChat = async (req, res) => {
  const { currentProfile, chatInfo } = req.auth;

  const settingIndex = chatInfo.settings.findIndex(
    (u) => String(u.userId) === String(currentProfile._id),
  );

  const nextArchive = chatInfo.settings[settingIndex].archived ? false : true;
  chatInfo.settings[settingIndex].archived = nextArchive;

  await Chat.findByIdAndUpdate(
    chatInfo._id,
    {
      $set: {
        settings: chatInfo.settings,
      },
    },
    { returnDocument: "after" },
  );

  return sendResponse(res, 200, {
    message: "Chat archive status updated",
    data: {
      chatId: chatInfo._id,
      archived: nextArchive,
    },
  });
};
