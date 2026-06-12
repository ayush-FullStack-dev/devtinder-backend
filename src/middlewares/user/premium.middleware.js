import Subscription from "../../models/subscription/Subscription.model.js";

import sendResponse from "../../helpers/sendResponse.js";

import { buildSubscriptionInfo } from "../../helpers/subscription/subscription.helper.js";
import { updateProfile } from "../../services/profile.service.js";

const defaultConfig = {
    gold: false
};

export const isPremiumUser = (config = defaultConfig) => {
    return (req, res, next) => {
        const { currentProfile } = req.auth;
        const premiumInfo = buildSubscriptionInfo(currentProfile.premium);

        if (!premiumInfo.isActive) {
            return sendResponse(res, 403, {
                message: "Premium feature locked",
                code: "PREMIUM_REQUIRED",
                requiredTier: ["silver", "gold"],
                upgradeHint: "Upgrade to Silver or Gold to unlock this feature"
            });
        }

        if (config?.gold && premiumInfo.tier !== "gold") {
            return sendResponse(res, 403, {
                message: "Upgrade to Gold to access this feature",
                code: "PREMIUM_REQUIRED",
                requiredTier: ["gold"],
                upgradeHint: "Gold unlocks full access"
            });
        }

        req.auth.premiumInfo = premiumInfo;
        return next();
    };
};

export const checkPremiumStatus = async (req, res, next) => {
    const { currentProfile } = req.auth;
    const day = 1000 * 60 * 60 * 24;
    let profileInfo = null;

    if (!currentProfile) {
        return req.status(500).json({
            success: false,
            message: "Invalid middleware orders"
        });
    }
    const premium = buildSubscriptionInfo(currentProfile.premium);

    if (premium.tier !== "free" && !premium.isActive) {
        await Subscription.findByIdAndUpdate(
            currentProfile.premium.subscriptionId,
            {
                used: true,
                carriedForwardDays: 0,
                isLifetime: false,
                using: false
            }
        );

        const lastSubscription = await Subscription.findOne({
            userId: currentProfile._id,
            $and: [
                {
                    $or: [
                        { carriedForwardDays: { $gt: 0 } },
                        { isLifetime: true }
                    ]
                },
                {
                    $expr: {
                        $neq: ["$fromPlan", "$toPlan"]
                    }
                }
            ],
            used: false,
            using: false
        }).sort({ createdAt: -1 });

        await Subscription.findByIdAndUpdate(
            currentProfile.premium.subscriptionId,
            {
                used: true,
                carriedForwardDays: 0,
                using: false
            }
        );

        if (!lastSubscription) {
            profileInfo = await updateProfile(
                { _id: currentProfile._id },
                {
                    $set: {
                        "premium.type": "free",
                        "premium.since": null,
                        "premium.subscriptionId": null,
                        "premium.expiresAt": null,
                        "premium.isLifetime": false
                    }
                }
            );
        } else {
            const expireIn = day * lastSubscription.carriedForwardDays;

            profileInfo = await updateProfile(
                { _id: currentProfile._id },
                {
                    $set: {
                        premium: {
                            type: lastSubscription.toPlan,
                            isLifetime: lastSubscription.isLifetime,
                            since: new Date(),
                            subscriptionId: lastSubscription._id,
                            expiresAt: lastSubscription.isLifetime
                                ? null
                                : new Date(Date.now() + expireIn)
                        }
                    }
                }
            );
        }
        req.auth.currentProfile = profileInfo;
    }

    return next();
};

export const checkPacksStatus = async (req, res, next) => {
    const profile = req.auth.currentProfile;

    if (
        profile &&
        profile.packs.activePack !== "none" &&
        profile.packs.expiresAt &&
        new Date(profile.packs.expiresAt).getTime() < Date.now()
    ) {
        const profileInfo = await updateProfile(
            { _id: profile._id },
            {
                $set: {
                    "packs.activePack": "none",
                    "packs.benefits": {},
                    "packs.features": {},
                    "packs.expiresAt": null
                }
            }
        );

        req.auth.currentProfile = profileInfo;
    }

    return next();
};
