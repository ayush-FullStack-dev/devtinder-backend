import { defaultIp } from "../../helpers/ip.js";

export const getInfo = (req, res, next) => {
    let ip = req.ip;
    if (ip?.startsWith("::ffff:")) {
        ip = ip?.replace("::ffff:", "");
    } else if (ip === "::1") {
        ip = defaultIp;
    }
    req.realIp = ip;
    if (!process.extra?.DOMAIN) {
        process.extra = {};
        process.extra.DOMAIN = req.get("host");
        if (process.extra.DOMAIN.includes("localhost")) {
            process.extra.DOMAIN_LINK = `http://${process.extra.DOMAIN}`;
        } else {
            process.extra.DOMAIN_LINK = `https://${process.env.DOMAIN}`;
        }
    }
    return next();
};

export const handleNotFound = (req, res) => {
    res.status(404).json({
        success: false,
        message: "404 Route not Found!"
    });
};

export const handleError = (error, req, res, next) => {
    res.status(error.statusCode || 500).json({
        success: false,
        type: error.name || "InternalServerError",
        message: error.message || "something went wrong!"
    });
};
