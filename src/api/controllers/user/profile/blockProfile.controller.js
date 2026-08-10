import Block from "../../../../models/Block.model.js";

import sendResponse from "../../../../helpers/sendResponse.js";

import { findProfile } from "../../../../services/profile.service.js";

export const blockUser = async (req, res) => {
    const { currentProfile } = req.auth;
    const profile = await findProfile({
        username: req.params?.username?.trim().toLowerCase()
    });

    if (!profile || profile?.visibility !== "public") {
        return sendResponse(res, 404, "Profile not found");
    }

    if (profile.id === currentProfile.id) {
        return sendResponse(res, 400, "You cannot block your own profile");
    }

    const isBlocked = await Block.exists({
        blockerUserId: currentProfile._id,
        blockedUserId: profile._id
    });

    if (isBlocked) {
        return sendResponse(res, 409, "User already blocked");
    }

    await Block.create({
        blockerUserId: currentProfile._id,
        blockedUserId: profile._id
    });

    return sendResponse(res, 200, "User blocked successfully");
};

export const unblockUser = async (req, res) => {
    const { currentProfile } = req.auth;
    const profile = await findProfile({
        username: req.params?.username?.trim().toLowerCase()
    });

    if (!profile || profile?.visibility !== "public") {
        return sendResponse(res, 404, "Profile not found");
    }

    const isBlocked = await Block.exists({
        blockerUserId: currentProfile._id,
        blockedUserId: profile._id
    });

    if (!isBlocked) {
        return sendResponse(res, 409, "User is not blocked");
    }

    await Block.deleteMany({
        blockerUserId: currentProfile._id,
        blockedUserId: profile._id
    });

    return sendResponse(res, 200, "User unblocked successfully");
};

export const blockedUser = async (req, res) => {
    const { currentProfile } = req.auth;
    let hasMore = false;
    const limit = Math.min(Number(req.query.limit) || 10, 50);

    const query = {
        blockerUserId: currentProfile._id
    };

    if (req.query?.cursor) {
        if (!isValidDate(req.query.cursor)) {
            return sendResponse(res, 400, {
                success: false,
                message: "Invalid cursor"
            });
        }
        query.createdAt = { $lt: new Date(req.query.cursor) };
    }

    const blockedInfos = await Block.find(query)
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit + 1)
        .populate(
            "blockedUserId",
            "username photos primaryPhoto displayName role tech_stack location"
        );

    const blockedCount = await Block.countDocuments({
        blockerUserId: currentProfile._id
    });

    if (blockedInfos.length > limit) {
        hasMore = true;
        blockedInfos.pop();
    }

    const nextCursor =
        blockedInfos.length > 0 && hasMore
            ? blockedInfos[blockedInfos.length - 1][createdAt]
            : null;

    const reponse = {
        total: blockedCount,
        blocked: [],
        pagination: {
            limit,
            hasMore,
            nextCursor
        }
    };

    for (const block of blockedInfos) {
        reponse.blocked.push({
            username: block.blockedUserId.username,
            displayName: block.blockedUserId.displayName,
            role: block.blockedUserId.role,
            photos: [
                ...block.blockedUserId.photos.map(p => ({
                    id: p._id,
                    url: p.url,
                    isPrimary: false,
                    createdAt: p.createdAt
                })),
                {
                    id: "none",
                    url: block.blockedUserId.primaryPhoto.url,
                    isPrimary: true,
                    createdAt: block.blockedUserId.primaryPhoto.createdAt
                }
            ],
            tech_stack: block.blockedUserId.tech_stack,
            location: {
                city: block.blockedUserId.location.city,
                country: block.blockedUserId.country
            },
            blockedAt: block.createdAt
        });
    }

    return sendResponse(res, 200, reponse);
};
