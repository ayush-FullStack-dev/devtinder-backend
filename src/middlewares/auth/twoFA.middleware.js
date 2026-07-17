import twoFAValidators from "../../validators/auth/twoFA.validator.js";

import sendResponse from "../../helpers/sendResponse.js";

import { buildDeviceInfo } from "../../helpers/buildDeviceInfo.js";
import { setRefreshExpiry, checkValidation } from "../../helpers/helpers.js";
import { getIpDetails } from "../../helpers/ip.js";

export const twoFAValidation = async (req, res, next) => {
    req.auth = {};
    const validate = checkValidation(
        twoFAValidators,
        req,
        "vaildation failed for twoFactorAuthentication"
    );

    if (!validate?.success) {
        return sendResponse(res, 400, validate.jsonResponse);
    }

    const ipDetails = await getIpDetails(req.realIp);
    req.auth.email = validate.value.email;
    req.auth.ip = req.realIp;
    req.auth.country = ipDetails.country;
    req.auth.loginMethod = req.body.method?.toUpperCase() || null;
    req.auth.refreshExpiry = setRefreshExpiry(validate.value);
    req.auth.deviceInfo = buildDeviceInfo(
        req.headers["user-agent"],
        validate.value,
        ipDetails
    );
    next();
};
