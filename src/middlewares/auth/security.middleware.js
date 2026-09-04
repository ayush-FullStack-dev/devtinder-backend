import sendResponse from "../../helpers/sendResponse.js";
import redis from "../../config/redis.js";

const defaultRateInfo = {
  limit: 5,
  route: "count",
  window: 1,
  block: 10,
};

const securityRoutes = new Set([
  "signup",
  "verify",
  "login:identify",
  "login:confirm",
  "2fa:start",
  "2fa:resend",
  "2fa:confirm",
  "refresh",
  "logout",
  "logout:all",
  "session:list",
  "account:me",
  "session:revoke",
  "password:start",
  "password:confirm",
  "password:forgot",
  "password:reset:get",
  "password:reset:post",
  "mfa:start",
  "mfa:verify",
  "approve_login",
  "reauth:identify",
  "reauth:confirm",
]);

class BoundedMap {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.map = new Map();
  }

  get(key) {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxSize) {
      const oldestKey = this.map.keys().next().value;
      this.map.delete(oldestKey);
    }
    this.map.set(key, value);
  }

  delete(key) {
    return this.map.delete(key);
  }
}

class LocalRateLimiter {
  constructor(maxSize = 10000) {
    this.store = new BoundedMap(maxSize);
  }

  check(route, identifier, limit, windowSeconds, blockSeconds) {
    const windowMs = windowSeconds * 1000;
    const blockMs = blockSeconds * 1000;
    const now = Date.now();

    const blockKey = `block:${route}:${identifier}`;
    const blockedUntil = this.store.get(blockKey);
    if (blockedUntil) {
      if (now < blockedUntil) {
        return { allowed: false, blocked: true };
      }
      this.store.delete(blockKey);
    }

    const rateKey = `rate:${route}:${identifier}`;
    let record = this.store.get(rateKey);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      this.store.set(rateKey, record);
      return { allowed: true, count: 1, blocked: false };
    }

    record.count++;
    this.store.set(rateKey, record);

    if (record.count > limit) {
      this.store.set(blockKey, now + blockMs);
      this.store.delete(rateKey);
      return { allowed: false, count: record.count, blocked: true };
    }

    return { allowed: true, count: record.count, blocked: false };
  }
}

const localLimiter = new LocalRateLimiter(10000);

let lastRedisErrorTime = 0;
const REDIS_ERROR_LOG_INTERVAL = 10000; // 10 seconds

function logRedisError(err, route) {
  const now = Date.now();
  if (now - lastRedisErrorTime > REDIS_ERROR_LOG_INTERVAL) {
    console.error(
      `[Redis RateLimiter Error] Failed to execute rate limiting for route: ${route}. Error: ${err.message}. Switching to local in-memory fallback.`,
    );
    lastRedisErrorTime = now;
  }
}

const rateLimitLua = `
local blockKey = KEYS[1]
local rateKey = KEYS[2]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local blockTime = tonumber(ARGV[3])

if redis.call("EXISTS", blockKey) == 1 then
    return -1
end

local count = redis.call("INCR", rateKey)
if count == 1 then
    redis.call("EXPIRE", rateKey, window)
end

if count > limit then
    redis.call("SET", blockKey, "blocked", "EX", blockTime)
    return -2
end

return count
`;

export const rateLimiter = (rateInfo = defaultRateInfo) => {
  const { limit, route } = rateInfo;
  const windowSeconds = rateInfo.window * 60;
  const blockSeconds = rateInfo.block * 60;

  return async (req, res, next) => {
    if (
      route === "health" ||
      route === "ping" ||
      req.path?.includes("/health") ||
      req.path?.includes("/ping")
    ) {
      return next();
    }

    const identifier = req?.auth?.user?.id || req.realIp;

    // Classify route
    const isSecurity = securityRoutes.has(route);

    if (!isSecurity) {
      const result = localLimiter.check(
        route,
        identifier,
        limit,
        windowSeconds,
        blockSeconds,
      );
      if (!result.allowed) {
        return sendResponse(res, 429, "Too many requests. Try again later.");
      }
      return next();
    }

    try {
      const blockKey = `rate:block:${route}:${identifier}`;
      const rateKey = `rate:${route}:${identifier}`;

      const result = await redis.eval(
        rateLimitLua,
        2,
        blockKey,
        rateKey,
        limit,
        windowSeconds,
        blockSeconds,
      );

      if (result === -1) {
        return sendResponse(res, 429, "Too many requests. Try again later.");
      }

      if (result === -2) {
        return sendResponse(
          res,
          429,
          `Too many requests. Blocked for ${rateInfo.block} minutes`,
        );
      }

      return next();
    } catch (err) {
      logRedisError(err, route);

      const emergencyLimit = Math.max(1, Math.floor(limit / 5));
      const emergencyBlock = blockSeconds;

      const result = localLimiter.check(
        `emergency:${route}`,
        identifier,
        emergencyLimit,
        windowSeconds,
        emergencyBlock,
      );

      if (!result.allowed) {
        return sendResponse(
          res,
          429,
          "Too many requests (emergency rate limiting active). Try again later.",
        );
      }

      return next();
    }
  };
};
