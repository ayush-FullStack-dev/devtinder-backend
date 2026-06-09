import sendResponse from "../../../../helpers/sendResponse.js";
import Match from "../../../../models/Match.model.js";

import {
  getBadges,
  buildSubscriptionInfo,
} from "../../../../helpers/subscription/subscription.helper.js";
import { paginationInfos } from "../../../../helpers/pagination.helper.js";
import { isValidDate } from "../../../../helpers/time.js";

export const revokeMatch = async (req, res) => {
  const { currentProfile } = req.auth;

  if (req.params?.matchId?.length !== 24) {
    return sendResponse(res, 400, {
      message: "Invalid match id format",
      code: "INVALID_MATCH_ID",
      hint: "matchId must be a 24-character MongoDB ObjectId",
    });
  }

  const matchDoc = await Match.findOne({
    _id: req.params?.matchId,
  }).populate({
    path: "users unmatchedBy",
    select: "visibility",
  });

  if (!matchDoc) {
    return sendResponse(res, 404, {
      message: "Match not found",
      code: "MATCH_NOT_FOUND",
    });
  }

  const isMember = matchDoc.users.some(
    (u) => String(u._id) === String(currentProfile._id),
  );

  if (!isMember) {
    return sendResponse(res, 403, {
      message: "You are not allowed to revoke this match",
      code: "MATCH_FORBIDDEN",
    });
  }

  const opponent = matchDoc.users.find(
    (u) => String(u._id) !== String(currentProfile._id),
  );

  if (opponent.visibility !== "public" || matchDoc.status === "blocked") {
    return sendResponse(res, 410, {
      message: "This match is no longer active",
      code: "MATCH_CLOSED",
      data: {
        status: matchDoc.status === "blocked" ? "blocked" : "unreachable",
      },
    });
  }

  if (matchDoc.status === "unmatched") {
    return sendResponse(res, 409, {
      message: "Match is already unmatched",
      code: "MATCH_ALREADY_CLOSED",
    });
  }

  const updateDoc = await Match.findOneAndUpdate(
    {
      _id: matchDoc._id,
    },
    {
      deletedAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      status: "unmatched",
      unmatchedAt: new Date(),
      unmatchedBy: currentProfile._id,
    },
    { returnDocument: "after" },
  );

  return sendResponse(res, 200, {
    message: "Unmatched successfully",
    data: {
      matchId: updateDoc._id,
      status: "unmatched",
      unmatchedAt: updateDoc.unmatchedAt,
      scheduledDeleteAt: updateDoc.deletedAt,
    },
  });
};

export const restoreMatch = async (req, res) => {
  const { currentProfile } = req.auth;

  if (req.params?.matchId?.length !== 24) {
    return sendResponse(res, 400, {
      message: "Invalid match id format",
      code: "INVALID_MATCH_ID",
      hint: "matchId must be a 24-character MongoDB ObjectId",
    });
  }

  const matchDoc = await Match.findOne({
    _id: req.params?.matchId,
  }).populate({
    path: "users unmatchedBy",
    select: "visibility",
  });

  if (!matchDoc) {
    return sendResponse(res, 404, {
      message: "Match not found",
      code: "MATCH_NOT_FOUND",
    });
  }

  const isMember = matchDoc.users.some(
    (u) => String(u._id) === String(currentProfile._id),
  );

  if (!isMember) {
    return sendResponse(res, 403, {
      message: "You are not allowed to restore this match",
      code: "MATCH_FORBIDDEN",
    });
  }

  if (matchDoc.status !== "unmatched") {
    return sendResponse(res, 409, {
      message: "Match cannot be restored",
      code: "MATCH_NOT_RESTORABLE",
    });
  }

  if (String(matchDoc.unmatchedBy._id) !== String(currentProfile._id)) {
    return sendResponse(res, 403, {
      message: "Only the user who unmatched can restore this match",
      code: "RESTORE_FORBIDDEN",
      hint: "This match can only be restored by the user who revoked it",
    });
  }

  const opponent = matchDoc.users.find(
    (u) => String(u._id) !== String(currentProfile._id),
  );

  if (opponent.visibility !== "public") {
    return sendResponse(res, 410, {
      message: "This match is no longer active",
      code: "MATCH_CLOSED",
      data: {
        status: "unreachable",
      },
    });
  }

  const updateDoc = await Match.findOneAndUpdate(
    {
      _id: matchDoc._id,
    },
    {
      deletedAt: null,
      status: "active",
      unmatchedAt: null,
      unmatchedBy: null,
    },
    { returnDocument: "after" },
  );

  return sendResponse(res, 200, {
    message: "Match restored successfully",
    data: {
      matchId: updateDoc._id,
      status: updateDoc.status,
      restoredAt: new Date(),
    },
  });
};

export const deactivatedMatches = async (req, res) => {
  const { currentProfile } = req.auth;
  const limit = Math.min(Number(req.query.limit) || 10, 40);
  const query = {
    users: currentProfile._id,
    unmatchedBy: currentProfile._id,
    status: "unmatched",
  };
  const sort = {
    createdAt: -1,
    _id: -1,
    lastMessageAt: -1,
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

  const deletedMatches = await Match.find(query)
    .sort(sort)
    .limit(limit + 1)
    .populate({
      path: "users unmatchedBy",
      select: "username displayName role premium visibility",
    });

  const { pagination, info } = paginationInfos(
    deletedMatches,
    limit,
    "createdAt",
  );

  const response = {
    restores: [],
    pagination,
  };

  for (const deletedMatch of info) {
    const opponent = deletedMatch.users.find(
      (u) => String(u._id) !== String(currentProfile._id),
    );

    if (opponent.visibility !== "public" || deletedMatch.status === "blocked") {
      continue;
    }

    response.restores.push({
      matchId: deletedMatch._id,
      user: {
        username: opponent.username,
        displayName: opponent.displayName,
        photos: [
          {
            id: "none",
            url: opponent.primaryPhoto.url,
            isPrimary: true,
            createdAt: opponent.primaryPhoto.createdAt,
          },
        ],
        role: opponent.role,
        badges: getBadges(opponent.premium),
      },
      unmatchedAt: deletedMatch.unmatchedAt,
      scheduledDeleteAt: deletedMatch.deletedAt,
      restoreAllowed: true,
    });
  }

  return sendResponse(res, 200, response);
};
