const base = {
  httpOnly: true,
  signed: true,
  sameSite: process.env.NODE_ENV === "production" ? "none" : "Lax",
  secure: process.env.NODE_ENV === "production",
};

export const cookieOption = base;

export const accessTokenCookieOption = {
  ...base,
  maxAge: 30 * 60 * 1000,
};

export const refreshTokenCookieOption = (ms) => ({
  ...base,
  maxAge: ms,
});

export const trustedSessionCookieOption = {
  ...base,
  maxAge: 60 * 24 * 60 * 60 * 1000, // 60 days
};

export const shortLivedCookieOption = {
  ...base,
  maxAge: 10 * 60 * 1000, // 10 minutes
};

export const riskLevel = ["verylow", "low", "mid", "high", "veryhigh"];
export const platform = ["web", "android", "os"];
export const eventType = ["login", "step_up", "mfa_manage"];
export const twoFaMethods = ["EMAIL", "TOTP", "BACKUPCODE"];
export const loginMethods = [
  "trusted_session",
  "passkey",
  "security_code",
  "password",
  "session_approval",
];

export const methodFailedAttemptLimits = {
  password: 5,
  security_code: 4,
  session_approval: 1,
  passkey: 1,
  trusted_session: 3,
};

export const recommendedActions = ["review_login", "change_password"];

export const userRefreshTokenSchema = {
  token: { type: String, required: true },
  used: {
    type: Boolean,
    default: false,
  },
  ip: String,
  country: String,
  ctxId: String,
  city: String,
  deviceId: String,
  browser: String,
  os: String,
  deviceType: String,
  deviceSize: String,
  deviceModel: String,
  timezone: String,
  fingerprint: String,
  deviceName: String,
  version: { type: Number, default: 1 },
  loginContext: {
    primary: {
      method: {
        type: String,
        enum: [...loginMethods],
        required: true,
      },
      timestamp: {
        type: Date,
        default: new Date(),
      },
    },

    mfa: {
      required: {
        type: Boolean,
        default: false,
      },
      complete: {
        type: Boolean,
        default: false,
      },
      methodsUsed: {
        type: String,
        enum: ["totp", "email_otp", "backup_code", "none"],
        default: "none",
      },
    },

    trust: {
      deviceTrusted: {
        type: Boolean,
        default: false,
      },
      sessionLevel: {
        type: String,
        enum: [...riskLevel],
        default: "low",
      },
    },
  },

  createdAt: {
    type: Date,
    default: () => new Date(),
  },
  lastActive: {
    type: Date,
    default: () => new Date(),
  },
};
