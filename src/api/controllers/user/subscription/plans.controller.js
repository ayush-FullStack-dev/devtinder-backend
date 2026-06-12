import Profile from "../../../../models/Profile.model.js";
import Subscription from "../../../../models/subscription/Subscription.model.js";

import sendResponse from "../../../../helpers/sendResponse.js";

import { PLANS } from "../../../../constants/subscription/plans.constant.js";

import { buildSubscriptionInfo } from "../../../../helpers/subscription/subscription.helper.js";

export const subscriptionPlans = async (req, res) => {
    const { currentProfile } = req.auth;
    const premium = buildSubscriptionInfo(currentProfile.premium);

    const currentSubscription = currentProfile.premium?.subscriptionId
        ? await Subscription.findById(currentProfile.premium.subscriptionId).select(
              "isTrial"
          )
        : null;
    const currentPlanIsTrial = !!currentSubscription?.isTrial;

    const trailInfo = await Subscription.findOne({
        userId: currentProfile._id,
        isTrial: true,
        action: "PURCHASE"
    }).populate([
        {
            path: "paymentOrderId",
            match: { status: "paid" }
        },
        {
            path: "autoPayOrderId",
            match: {
                status: { $in: ["authenticated", "active"] }
            }
        }
    ]);

    const alreadyUsed = !!(
        trailInfo &&
        (trailInfo.paymentOrderId || trailInfo.autoPayOrderId)
    );

    const hasActiveGold = premium.isActive && premium.tier === "gold";

    const isTrialEligible = !alreadyUsed && !hasActiveGold;

    const trialPlan = {
        id: "gold_trial",
        label: "Gold (30 Days Trial)",
        price: 0,
        currency: "INR",
        duration: 30,
        isTrial: true,
        popular: false,
        isDefault: false,
        isCurrent: false,
        canUpgrade: false,
        canDowngrade: false,
        requiresPayment: false,
        features: PLANS.GOLD.features
    };

    const silverUsers = await Profile.countDocuments({
        "premium.type": "silver"
    });

    const goldUsers = await Profile.countDocuments({
        "premium.type": "gold"
    });

    const totalPaidUsers = silverUsers + goldUsers;

    const silverPercentage = totalPaidUsers ? silverUsers / totalPaidUsers : 0;

    const goldPercentage = totalPaidUsers ? goldUsers / totalPaidUsers : 0;

    const silverRevenue = silverUsers * PLANS.SILVER.price;
    const goldRevenue = goldUsers * PLANS.GOLD.price;

    const totalRevenue = silverRevenue + goldRevenue;

    const silverRevenueShare = totalRevenue ? silverRevenue / totalRevenue : 0;

    const goldRevenueShare = totalRevenue ? goldRevenue / totalRevenue : 0;

    const silverScore = silverPercentage * 0.6 + silverRevenueShare * 0.4;
    const goldScore = goldPercentage * 0.6 + goldRevenueShare * 0.4;

    let popularPlan = null;
    const currentPlanId = premium.isActive ? premium.tier : "free";

    if (silverScore > goldScore) popularPlan = "silver";
    else if (goldScore > silverScore) popularPlan = "gold";

    const plans = ["free", "silver", "gold"].map(planId => {
        const plan = PLANS[planId.toUpperCase()];
        const isCurrent = planId === currentPlanId;

        return {
            id: planId,
            label: planId.charAt(0).toUpperCase() + planId.slice(1),
            price: plan.price,
            currency: "INR",
            duration: plan.duration,
            isDefault: planId === "free",
            popular: popularPlan === planId,
            isCurrent,
            canUpgrade:
                plan.price > (PLANS[currentPlanId.toUpperCase()]?.price || 0),
            canDowngrade:
                plan.price < (PLANS[currentPlanId.toUpperCase()]?.price || 0),
            requiresPayment: plan.price > 0 && !isCurrent,
            features: plan.features
        };
    });

    isTrialEligible ? plans.push(trialPlan) : "";

    return sendResponse(res, 200, {
        currentPlan: {
            id: currentPlanId,
            label:
                currentPlanId === "free"
                    ? "Free"
                    : currentPlanId === "gold"
                      ? currentPlanIsTrial
                        ? "Gold Trial"
                        : "Gold"
                      : "Silver",
            isPaid: currentPlanId !== "free",
            isTrial: currentPlanIsTrial,
            startedAt:
                currentPlanId === "free" ? null : currentProfile.premium.since,
            expiresAt: currentPlanId === "free" ? null : premium.expiresAt,
            isLifetime: currentPlanId !== "free" ? premium.isLifetime : false
        },

        popularPlan,
        plans
    });
};
