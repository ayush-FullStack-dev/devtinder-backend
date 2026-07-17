import { generateHash } from "../helpers/hash.js";
import redis from "../config/redis.js";

export const getOtpSetOtp = async ctxId => {
    const otp = Math.floor(100000 + Math.random() * 900000);
    const saveOtp = await generateHash(otp.toString());
    await redis.set(`otp:${ctxId}`, saveOtp, "EX", 600);
    return otp;
};

export const setSession = async (
    data,
    user,
    link = "2fa:session",
    ...others
) => {
    if (typeof data !== "string") {
        data = JSON.stringify(data);
    }
    if (typeof user === "string") {
        await redis.set(`${link}:${user}`, data, ...others);
        return true;
    }
    await redis.set(`${link}:${user._id}`, data, ...others);
    return true;
};

export const cleanup2fa = async (user, hash) => {
    let id = user._id;
    if (typeof user !== "object") {
        id = user;
    }
    await redis.del(`device:info:${id}`);
    await redis.del(`2fa:session:${id}`);
    await redis.del(`2fa:data:${id}`);
    await redis.del(`2fa:fp:start:${id}`);
    await redis.del(`otp:email:${hash}`);
    return true;
};

export const cleanupLogin = async user => {
    let id = user._id;
    if (typeof user !== "object") {
        id = user;
    }
    await redis.del(`login:info:${id}`);
    await redis.del(`login:ctx:${id}`);
    return true;
};

export const getSession = async (link, option) => {
    let data = await redis.get(link);
    if (typeof option === "object" || option === undefined) {
        return JSON.parse(data);
    }
    return data;
};

export const cleanupMfa = async (hash, mail) => {
    await redis.del(`verify:mfa:${hash}`);
    await redis.del(`verify:device:${hash}`);
    await redis.del(`email:verified:${hash}`);
    await redis.del(`verified:email:${mail}`);
    return true;
};

export const removeKeys = async link => {
    await redis.del(link);
    return true;
};

export const runRedisLua = async (lua, link, keys = 1) => {
    let data = await redis.eval(lua, keys, link);
    try {
        data = JSON.parse(data);
        return data;
    } catch (error) {
        return data;
    }
};
