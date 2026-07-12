import geoip from "geoip-lite";
import axios from "axios";
import redis from "../config/redis.js";

export const defaultIp = "106.192.105.230";

export const getAltIpDetails = ip => {
    const geo = geoip.lookup(ip);
    return {
        country: geo?.country,
        timezone: geo?.timezone,
        region: geo?.region,
        city: geo?.city,
        ip,
        location: `${geo?.city},${geo?.country}`
    };
};

export async function getIpDetails(ip = defaultIp) {
    if (ip.includes("::ffff:") || ip === "127.0.0.1") {
        ip = defaultIp;
    }

    const cacheKey = `ip:geo:${ip}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    try {
        const { data } = await axios.get(
            `https://ipinfo.io/${ip}?token=${process.env.IP_TOKEN}`
        );
        const result = {
            country: data?.country,
            timezone: data?.timezone,
            region: data?.region,
            city: data?.city,
            ip: data.ip,
            location: `${data?.city},${data?.country}`
        };
        await redis.set(cacheKey, JSON.stringify(result), "EX", 3600);
        return result;
    } catch (error) {
        const result = getAltIpDetails(ip);
        await redis.set(cacheKey, JSON.stringify(result), "EX", 3600);
        return result;
    }
}

export const maskIp = ip => {
    if (!ip || typeof ip !== "string") return "";

    // IPv6
    if (ip.includes(":")) {
        const parts = ip.split(":");
        return `${parts[0]}:${parts[1]}:****:****:****:${
            parts[parts.length - 1]
        }`;
    }

    // IPv4
    const parts = ip.split(".");
    if (parts.length !== 4) return ip;

    return `${parts[0]}.***.***.${parts[3]}`;
};

export const getCoordinates = async (ip = defaultIp) => {
    if (ip.includes("::ffff:") || ip === "127.0.0.1") {
        ip = defaultIp;
    }

    try {
        const { data } = await axios.get(
            `https://ipinfo.io/${ip}?token=${process.env.IP_TOKEN}`
        );
        return {
            latitude: data?.loc[0],
            longitude: data?.loc[1]
        };
    } catch (error) {
        const geo = geoip.lookup(ip);
        return {
            latitude: geo?.ll[0],
            longitude: geo?.ll[1]
        };
    }
};
