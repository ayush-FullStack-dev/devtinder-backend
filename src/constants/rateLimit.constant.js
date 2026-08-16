export const WINDOW = {
  SHORT: 2, // 2 minutes  — high-frequency endpoints
  STANDARD: 5, // 5 minutes  — most normal API endpoints
  AUTH: 15, // 15 minutes — authentication/security endpoints
  LONG: 30, // 30 minutes — sensitive operations (forgot password, etc.)
};

export const BLOCK = {
  LIGHT: 2, // 2 minutes  — minor cooldown
  SHORT: 5, // 5 minutes  — standard block
  MEDIUM: 10, // 10 minutes — moderate block
  LONG: 15, // 15 minutes — strict block
  SEVERE: 30, // 30 minutes — very strict block for sensitive ops
};


export const AUTH_LIMITS = {
  signup: {
    maxRequests: 10,
    windowMinutes: WINDOW.AUTH,
    blockMinutes: BLOCK.MEDIUM,
  },

  verify: {
    maxRequests: 20,
    windowMinutes: WINDOW.AUTH,
    blockMinutes: BLOCK.SHORT,
  },


  "login:identify": {
    maxRequests: 20,
    windowMinutes: WINDOW.AUTH,
    blockMinutes: BLOCK.SHORT,
  },


  "login:confirm": {
    maxRequests: 15,
    windowMinutes: WINDOW.AUTH,
    blockMinutes: BLOCK.MEDIUM,
  },

  "2fa:start": {
    maxRequests: 10,
    windowMinutes: WINDOW.AUTH,
    blockMinutes: BLOCK.MEDIUM,
  },
  "2fa:resend": {
    maxRequests: 8,
    windowMinutes: WINDOW.AUTH,
    blockMinutes: BLOCK.LONG,
  },
  "2fa:confirm": {
    maxRequests: 10,
    windowMinutes: WINDOW.AUTH,
    blockMinutes: BLOCK.LONG,
  },


  refresh: {
    maxRequests: 30,
    windowMinutes: WINDOW.AUTH,
    blockMinutes: BLOCK.SHORT,
  },

  logout: {
    maxRequests: 10,
    windowMinutes: WINDOW.STANDARD,
    blockMinutes: BLOCK.SHORT,
  },
  "logout:all": {
    maxRequests: 5,
    windowMinutes: WINDOW.STANDARD,
    blockMinutes: BLOCK.MEDIUM,
  },

  "session:list": {
    maxRequests: 30,
    windowMinutes: WINDOW.STANDARD,
    blockMinutes: BLOCK.SHORT,
  },
  "session:revoke": {
    maxRequests: 10,
    windowMinutes: WINDOW.AUTH,
    blockMinutes: BLOCK.MEDIUM,
  },


  "account:me": {
    maxRequests: 60,
    windowMinutes: WINDOW.STANDARD,
    blockMinutes: BLOCK.LIGHT,
  },

  "password:start": {
    maxRequests: 5,
    windowMinutes: WINDOW.AUTH,
    blockMinutes: BLOCK.LONG,
  },
  "password:confirm": {
    maxRequests: 5,
    windowMinutes: WINDOW.AUTH,
    blockMinutes: BLOCK.LONG,
  },


  "password:forgot": {
    maxRequests: 5,
    windowMinutes: WINDOW.LONG,
    blockMinutes: BLOCK.SEVERE,
  },


  "password:reset:get": {
    maxRequests: 10,
    windowMinutes: WINDOW.AUTH,
    blockMinutes: BLOCK.MEDIUM,
  },
  "password:reset:post": {
    maxRequests: 5,
    windowMinutes: WINDOW.AUTH,
    blockMinutes: BLOCK.LONG,
  },


  "mfa:start": {
    maxRequests: 5,
    windowMinutes: WINDOW.AUTH,
    blockMinutes: BLOCK.MEDIUM,
  },
  "mfa:verify": {
    maxRequests: 5,
    windowMinutes: WINDOW.AUTH,
    blockMinutes: BLOCK.LONG,
  },


  approve_login: {
    maxRequests: 10,
    windowMinutes: WINDOW.STANDARD,
    blockMinutes: BLOCK.MEDIUM,
  },

  "check:username": {
    maxRequests: 60,
    windowMinutes: WINDOW.STANDARD,
    blockMinutes: BLOCK.SHORT,
  },
  "check:email": {
    maxRequests: 60,
    windowMinutes: WINDOW.STANDARD,
    blockMinutes: BLOCK.SHORT,
  },

  "manage:base": {
    maxRequests: 60,
    windowMinutes: WINDOW.STANDARD,
    blockMinutes: BLOCK.SHORT,
  },
  "mfa:manage:base": {
    maxRequests: 60,
    windowMinutes: WINDOW.STANDARD,
    blockMinutes: BLOCK.SHORT,
  },
  account: {
    maxRequests: 40,
    windowMinutes: WINDOW.STANDARD,
    blockMinutes: BLOCK.SHORT,
  },
};

export const PROFILE_LIMITS = {
  "profile:base": {
    maxRequests: 120,
    windowMinutes: WINDOW.STANDARD,
    blockMinutes: BLOCK.SHORT,
  },
  "profile:delete": {
    maxRequests: 3,
    windowMinutes: WINDOW.LONG,
    blockMinutes: BLOCK.SEVERE,
  },
  "profile:restore": {
    maxRequests: 3,
    windowMinutes: WINDOW.LONG,
    blockMinutes: BLOCK.SEVERE,
  },
  "profile:photo:upload": {
    maxRequests: 20,
    windowMinutes: WINDOW.STANDARD,
    blockMinutes: BLOCK.SHORT,
  },
  "profile:photo:replace": {
    maxRequests: 15,
    windowMinutes: WINDOW.STANDARD,
    blockMinutes: BLOCK.SHORT,
  },
  "profile:photo:delete": {
    maxRequests: 20,
    windowMinutes: WINDOW.STANDARD,
    blockMinutes: BLOCK.SHORT,
  },
  "profile:likes": {
    maxRequests: 30,
    windowMinutes: WINDOW.STANDARD,
    blockMinutes: BLOCK.SHORT,
  },
  "profile:public:view": {
    maxRequests: 100,
    windowMinutes: WINDOW.STANDARD,
    blockMinutes: BLOCK.SHORT,
  },
  "profile:public:like": {
    maxRequests: 60,
    windowMinutes: WINDOW.SHORT,
    blockMinutes: BLOCK.SHORT,
  },
  "profile:public:unlike": {
    maxRequests: 60,
    windowMinutes: WINDOW.SHORT,
    blockMinutes: BLOCK.SHORT,
  },
  "profile:block": {
    maxRequests: 10,
    windowMinutes: WINDOW.STANDARD,
    blockMinutes: BLOCK.LIGHT,
  },
  "profile:unblock": {
    maxRequests: 10,
    windowMinutes: WINDOW.STANDARD,
    blockMinutes: BLOCK.LIGHT,
  },
  "profile:report": {
    maxRequests: 5,
    windowMinutes: WINDOW.STANDARD,
    blockMinutes: BLOCK.SHORT,
  },
  "profile:ringtone:incoming:update": {
    maxRequests: 20,
    windowMinutes: WINDOW.STANDARD,
    blockMinutes: BLOCK.SHORT,
  },
  "profile:ringtone:incoming:delete": {
    maxRequests: 20,
    windowMinutes: WINDOW.STANDARD,
    blockMinutes: BLOCK.SHORT,
  },
  "profile:ringtone:ringback:update": {
    maxRequests: 10,
    windowMinutes: WINDOW.STANDARD,
    blockMinutes: BLOCK.MEDIUM,
  },
  "profile:ringtone:ringback:delete": {
    maxRequests: 10,
    windowMinutes: WINDOW.STANDARD,
    blockMinutes: BLOCK.MEDIUM,
  },
};


export const DISCOVER_LIMITS = {
  "discover:base": {
    maxRequests: 60,
    windowMinutes: WINDOW.SHORT,
    blockMinutes: BLOCK.SHORT,
  },
  "discover:rewind": {
    maxRequests: 15,
    windowMinutes: WINDOW.STANDARD,
    blockMinutes: BLOCK.MEDIUM,
  },
  "discover:boost": {
    maxRequests: 5,
    windowMinutes: WINDOW.STANDARD,
    blockMinutes: BLOCK.SEVERE,
  },
};

export const MATCH_LIMITS = {
  "match:base": {
    maxRequests: 80,
    windowMinutes: WINDOW.SHORT,
    blockMinutes: BLOCK.MEDIUM,
  },
  "match:list": {
    maxRequests: 40,
    windowMinutes: WINDOW.SHORT,
    blockMinutes: BLOCK.SHORT,
  },
  "match:detail": {
    maxRequests: 40,
    windowMinutes: WINDOW.SHORT,
    blockMinutes: BLOCK.SHORT,
  },
  "match:revoke": {
    maxRequests: 10,
    windowMinutes: WINDOW.STANDARD,
    blockMinutes: BLOCK.MEDIUM,
  },
  "match:restore": {
    maxRequests: 10,
    windowMinutes: WINDOW.STANDARD,
    blockMinutes: BLOCK.MEDIUM,
  },
};


export const CHAT_LIMITS = {
  "chat:base": {
    maxRequests: 60,
    windowMinutes: WINDOW.SHORT,
    blockMinutes: BLOCK.SHORT,
  },
};


export const CALL_LIMITS = {
  "call:base": {
    maxRequests: 50,
    windowMinutes: WINDOW.SHORT,
    blockMinutes: BLOCK.SHORT,
  },
};

export const PAYMENT_LIMITS = {
  "payment:base": {
    maxRequests: 100,
    windowMinutes: WINDOW.SHORT,
    blockMinutes: BLOCK.LIGHT,
  },
};

export const SUBSCRIPTION_LIMITS = {
  "subscription:base": {
    maxRequests: 50,
    windowMinutes: WINDOW.SHORT,
    blockMinutes: BLOCK.SHORT,
  },
  "subscription:checkout": {
    maxRequests: 10,
    windowMinutes: WINDOW.STANDARD,
    blockMinutes: BLOCK.MEDIUM,
  },
  "subscription:activate_trial": {
    maxRequests: 5,
    windowMinutes: WINDOW.LONG,
    blockMinutes: BLOCK.SEVERE,
  },
  "subscription:refund": {
    maxRequests: 5,
    windowMinutes: WINDOW.LONG,
    blockMinutes: BLOCK.SEVERE,
  },
  "subscription:refund_autopay": {
    maxRequests: 5,
    windowMinutes: WINDOW.LONG,
    blockMinutes: BLOCK.SEVERE,
  },
  "subscription:pause_autopay": {
    maxRequests: 10,
    windowMinutes: WINDOW.AUTH,
    blockMinutes: BLOCK.SHORT,
  },
  "subscription:resume_autopay": {
    maxRequests: 10,
    windowMinutes: WINDOW.AUTH,
    blockMinutes: BLOCK.SHORT,
  },
  "subscription:cancel_autopay": {
    maxRequests: 3,
    windowMinutes: WINDOW.LONG,
    blockMinutes: BLOCK.SEVERE,
  },
};

export const PUSH_LIMITS = {
  "push:subscribe": {
    maxRequests: 20,
    windowMinutes: WINDOW.STANDARD,
    blockMinutes: BLOCK.SHORT,
  },
  "push:unsubscribe": {
    maxRequests: 20,
    windowMinutes: WINDOW.STANDARD,
    blockMinutes: BLOCK.SHORT,
  },
};

export function rl(config) {
  return {
    limit: config.maxRequests,
    window: config.windowMinutes,
    block: config.blockMinutes,
    route: undefined,
  };
}
