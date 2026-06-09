import mongoose from "mongoose";

const PaymentOrderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Profile",
      required: true,
      index: true,
    },

    amount: {
      base: {
        type: Number,
        required: true,
      },
      discount: {
        type: Number,
        default: 0,
      },
      final: {
        type: Number,
        required: true,
      },
      currency: {
        type: String,
        default: "INR",
      },
    },

    coupon: {
      couponId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Coupon",
        index: true,
      },
      code: {
        type: String,
        uppercase: true,
      },
      discountType: {
        type: String,
        enum: ["flat", "percentage"],
      },
      discountValue: Number,
    },

    method: {
      type: String,
      enum: ["upi", "card", "netbanking", "wallet"],
    },

    gateway: {
      type: String,
      enum: ["razorpay", "cashfree"],
      required: true,
    },

    gatewayOrderId: String,
    gatewayPaymentId: String,
    gatewaySignature: String,

    status: {
      type: String,
      enum: ["created", "paid", "failed", "refunded", "refund_pending", "refund_failed"],
      default: "created",
      index: true,
    },

    refundId:{
      type: String,
      default: null,
    },

    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 1000 * 60 * 10),
    },

    paidAt: {
      type: Date,
      default: null,
    },
    failedAt: {
      type: Date,
      default: null,
    },
    failureReason: {
      type: String,
      default: null,
    },
    refundedAt: {
      type: Date,
      default: null,
    },

    metadata: {
      ip: String,
      userAgent: String,
      deviceId: String,
    },
  },
  {
    timestamps: true,
  },
);

PaymentOrderSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("PaymentOrder", PaymentOrderSchema);
