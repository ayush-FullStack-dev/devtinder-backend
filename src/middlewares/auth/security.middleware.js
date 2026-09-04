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
        return {
          allowed: false,
          blocked: true,
          retryAfter: Math.max(1, Math.ceil((blockedUntil - now) / 1000)),
        };
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
      return {
        allowed: true,
        count: 1,
        blocked: false,
      };
    }

    record.count++;
    this.store.set(rateKey, record);

    if (record.count > limit) {
      const blockedUntil = now + blockMs;

      this.store.set(blockKey, blockedUntil);
      this.store.delete(rateKey);

      return {
        allowed: false,
        count: record.count,
        blocked: true,
        retryAfter: blockSeconds,
      };
    }

    return {
      allowed: true,
      count: record.count,
      blocked: false,
    };
  }
}

const localLimiter = new LocalRateLimiter(10000);

let lastRedisErrorTime = 0;
const REDIS_ERROR_LOG_INTERVAL = 10000;

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
    local ttl = redis.call("TTL", blockKey)
    return {-1, ttl}
end

local count = redis.call("INCR", rateKey)

if count == 1 then
    redis.call("EXPIRE", rateKey, window)
end

if count > limit then
    redis.call("SET", blockKey, "blocked", "EX", blockTime)
    return {-2, blockTime}
end

return {count, 0}
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
        return sendResponse(res, 429, {
          code: result.blocked ? "RATE_LIMIT_BLOCKED" : "RATE_LIMITED",
          message: "Too many requests. Try again later.",
          retryAfter: result.retryAfter,
          blocked: result.blocked,
          isRateLimit: true,
        });
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

      const status = Number(result[0]);
      const retryAfter = Math.max(1, Number(result[1]));

      if (status === -1) {
        return sendResponse(res, 429, {
          code: "RATE_LIMIT_BLOCKED",
          message: "Too many requests. Try again later.",
          retryAfter,
          blocked: true,
          isRateLimit: true,
        });
      }

      if (status === -2) {
        return sendResponse(res, 429, {
          code: "RATE_LIMIT_BLOCKED",
          message: "Too many requests. Try again later.",
          retryAfter,
          blocked: true,
          isRateLimit: true,
        });
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
        return sendResponse(res, 429, {
          code: result.blocked ? "RATE_LIMIT_BLOCKED" : "RATE_LIMITED",
          message: "Too many requests. Try again later.",
          retryAfter: result.retryAfter,
          blocked: result.blocked,
          isRateLimit: true,
        });
      }

      return next();
    }
  };
};
