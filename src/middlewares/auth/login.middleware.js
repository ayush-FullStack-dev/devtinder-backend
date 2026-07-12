import {
    loginValidator,
    loginIdentifyValidator
} from "../../validators/auth/login.validator.js";

import sendResponse from "../../helpers/sendResponse.js";

import { buildDeviceInfo } from "../../helpers/buildDeviceInfo.js";
import { verifyToken } from "../../helpers/jwt.js";
import { checkValidation } from "../../helpers/helpers.js";
import { getTime } from "../../helpers/time.js";
import { getIpDetails } from "../../helpers/ip.js";

import { fingerprintBuilder } from "../../utils/fingerprint.js";
import { findUser } from "../../services/user.service.js";

export const loginIdentifyValidation = async (req, res, next) => {
    const { email, username } = req.body;
    req.auth = {};
    const validate = checkValidation(
        loginIdentifyValidator,
        req,
        "vaildation failed for login"
    );

    if (!validate?.success) {
        return sendResponse(res, 400, validate.jsonResponse);
    }

    if (email) {
        req.auth.login = email;
        req.auth.fieldName = "email";
    } else {
        req.auth.login = username;
        req.auth.fieldName = "username";
    }

    const user = await findUser({
        [req.auth.fieldName]: req.auth.login
    });

    if (!user) {
        return sendResponse(res, 401, {
            message: "Invalid email or username",
            code: "INVALID_CREDENTIALS"
        });
    }

    const deviceInfo = buildDeviceInfo(
        req.headers["user-agent"],
        validate.value,
        await getIpDetails(req.realIp)
    );

    deviceInfo.fingerprint = fingerprintBuilder(deviceInfo);
    req.auth.user = user;
    req.auth.deviceInfo = deviceInfo;
    req.auth.time = getTime(req);
    return next();
};
