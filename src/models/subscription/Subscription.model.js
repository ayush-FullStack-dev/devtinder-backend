import mongoose from "mongoose";

const SubscriptionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Profile",
            required: true,
            index: true
        },

        paymentOrderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "PaymentOrder",
            index: true,
            default: null
        },

        autoPayOrderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AutoPay",
            index: true,
            default: null
        },

        isTrial: {
            type: Boolean,
            default: false
        },

        action: {
            type: String,
            enum: ["PURCHASE", "UPGRADE", "RENEW", "EXPIRE", "PAYMENT_FAILED"],
            required: true
        },

        
        fromPlan: {
            type: String,
            enum: ["free", "silver", "gold"],
            default: "free"
        },

        toPlan: {
            type: String,
            enum: ["free", "silver", "gold"],
            required: true
        },

        carriedForwardDays: {
            type: Number,
            default: 0
        },

        isLifetime: {
            type: Boolean,
            default: false
        },

        used: {
            type: Boolean,
            default: false
        },
        
        using: {
            type: Boolean,
            default: false
        },

        note: {
            type: String
        }
    },
    {
        timestamps: true
    }
);

export default mongoose.model("Subscription", SubscriptionSchema);
