import sendResponse from "../../helpers/sendResponse.js";

import { findProfile, updateProfile } from "../../services/profile.service.js";

import Block from "../../models/Block.model.js";

export const isProfileExists = async (req, res, next) => {
    const { user } = req.auth;
    const profile = await findProfile({
        userId: user._id
    });

    if (!profile) {
        return sendResponse(res, 404, {
            message: "Profile not found",
            next: "create_profile",
            route: "/profile/setup"
        });
    }

    req.auth.currentProfile = profile;
    return next();
};

export const optionalProfile = async (req, res, next) => {
    const { logged, info } = req.auth;
    if (!logged) {
        return next();
    }

    const profile = await findProfile({
        userId: info?._id
    });

    req.auth.currentProfile = profile;
    return next();
};





export const isProfileBlocked = async (req, res, next) => {
    const { currentProfile, logged } = req.auth;

    const profile = await findProfile({
        username: req.params?.username?.trim().toLowerCase()
    });

    if (!profile || profile?.visibility !== "public") {
        return sendResponse(res, 404, "Profile not found");
    }
    req.auth.profile = profile;

    if (!currentProfile) {
        return next();
    }

    const isBlocked = await Block.exists({
        blockerUserId: currentProfile._id,
        blockedUserId: profile._id
    });

    if (isBlocked) {
        return sendResponse(res, 404, "Profile not found");
    }

    return next();
};
