
import { prettyErrorResponse } from "./ApiError.js";

import { joiOptions } from "../constants/validator.constant.js";

export const setRefreshExpiry = validateValues => {
    if (validateValues.remember) {
        return "30d";
    }
    return "1d";
};

export const checkValidation = (validateSchema, req, msg) => {
    const validate = validateSchema.validate(req.body, joiOptions);
    if (validate.error) {
        const jsonResponse = prettyErrorResponse(validate, msg);
        return { success: false, jsonResponse };
    }
    return { success: true, value: validate.value };
};

export const collectOnMethod = twoFAMethods => {
    const methods = [];

    for (const method in twoFAMethods) {
        if (twoFAMethods[method].enabled) {
            methods.push(twoFAMethods[method].type);
        }
    }

    return methods;
};

export const getAsterisk = (maskMails, skips = []) => {
    const asterisk = [];
    for (let i = 0; i < maskMails.length; i++) {
        if (maskMails[0] === maskMails[i]) {
            continue;
        } else if (
            skips.includes(i) ||
            maskMails[maskMails.length - 1] === maskMails[i]
        ) {
            continue;
        }
        asterisk.push("*");
    }

    return asterisk.join("");
};
