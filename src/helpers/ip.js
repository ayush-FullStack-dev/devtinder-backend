import geoip from "geoip-lite";
import axios from "axios";

export const defaultIp = "106.192.105.230";

class BoundedTTLMap {
  constructor(maxSize = 5000, defaultTtlMs = 3600000) {
    this.maxSize = maxSize;
    this.defaultTtlMs = defaultTtlMs;
    this.map = new Map();
  }

  get(key) {
    if (!this.map.has(key)) return undefined;
    const entry = this.map.get(key);
    if (Date.now() > entry.expiry) {
      this.map.delete(key);
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key, value, ttlSeconds) {
    const ttlMs = ttlSeconds ? ttlSeconds * 1000 : this.defaultTtlMs;
    const expiry = Date.now() + ttlMs;

    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxSize) {
      let evicted = false;
      const now = Date.now();
      for (const [k, entry] of this.map.entries()) {
        if (now > entry.expiry) {
          this.map.delete(k);
          evicted = true;
          break;
        }
      }
      if (!evicted) {
        const oldestKey = this.map.keys().next().value;
        this.map.delete(oldestKey);
      }
    }
    this.map.set(key, { value, expiry });
  }
}

const ipGeoCache = new BoundedTTLMap(5000, 3600000);

export const getAltIpDetails = (ip) => {
  const geo = geoip.lookup(ip);

  return {
    country: geo?.country || "UNKNOWN",
    timezone: geo?.timezone || "UNKNOWN",
    region: geo?.region || "UNKNOWN",
    city: geo?.city || "UNKNOWN",
    ip,
    location:
      [geo?.city, geo?.region, geo?.country].filter(Boolean).join(", ") ||
      "UNKNOWN",
  };
};

const isPrivateIp = (ip) => {
  if (!ip) return true;

  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ||
    ip.includes("::ffff:127.") ||
    ip.includes("::ffff:10.") ||
    ip.includes("::ffff:192.168.")
  );
};

export async function getIpDetails(ip = defaultIp) {
   if (isPrivateIp(ip)) {
     ip = defaultIp;
   }

  const cached = ipGeoCache.get(ip);

  if (cached) {
    return cached;
  }

  try {
    const { data } = await axios.get(
      `https://ipinfo.io/${ip}?token=${process.env.IP_TOKEN}`,
    );

    const result = {
      country: data?.country || "UNKNOWN",
      timezone: data?.timezone || "UNKNOWN",
      region: data?.region || "UNKNOWN",
      city: data?.city || "UNKNOWN",
      ip: data?.ip || ip,

      location:
        [data?.city, data?.region, data?.country].filter(Boolean).join(", ") ||
        "UNKNOWN",
    };

    ipGeoCache.set(ip, result, 3600);

    return result;
  } catch (error) {
    const result = getAltIpDetails(ip);

    ipGeoCache.set(ip, result, 3600);

    return result;
  }
}

export const maskIp = (ip) => {
  if (!ip || typeof ip !== "string") return "";

  // IPv6
  if (ip.includes(":")) {
    const parts = ip.split(":");
    return `${parts[0]}:${parts[1]}:****:****:****:${parts[parts.length - 1]}`;
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
      `https://ipinfo.io/${ip}?token=${process.env.IP_TOKEN}`,
    );
    return {
      latitude: data?.loc[0],
      longitude: data?.loc[1],
    };
  } catch (error) {
    const geo = geoip.lookup(ip);
    return {
      latitude: geo?.ll[0],
      longitude: geo?.ll[1],
    };
  }
};
