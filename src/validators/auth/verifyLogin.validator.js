import joi from "joi";

import { loginMethods, riskLevel } from "../../constants/auth.constant.js";

const passkeyPayloadSchema = joi.object({
  id: joi.string().required().messages({
    "any.required": "passkey id is required.",
  }),
  rawId: joi.string().required().messages({
    "any.required": "passkey rawId is required.",
  }),
  type: joi.string().valid("public-key").required().messages({
    "any.required": "passkey type is required.",
    "any.only": "passkey type must be public-key.",
  }),
  response: joi
    .object({
      authenticatorData: joi.string().required().messages({
        "any.required": "authenticatorData is required for passkey.",
      }),
      clientDataJSON: joi.string().required().messages({
        "any.required": "clientDataJSON is required for passkey.",
      }),
      signature: joi.string().required().messages({
        "any.required": "signature is required for passkey.",
      }),
      userHandle: joi.string().allow(null).optional(),
    })
    .required(),
  clientExtensionResults: joi.object().required().messages({
    "any.required": "clientExtensionResults is required for passkey.",
  }),
  authenticatorAttachment: joi
    .string()
    .valid("platform", "cross-platform")
    .optional(),
});

export const verifyLoginValidator = joi.object({
  risk: joi
    .string()
    .valid(...riskLevel)
    .required()
    .messages({
      "any.required": "risk is required.",
    }),
  method: joi
    .string()
    .valid(...loginMethods)
    .required()
    .messages({
      "any.required": "method is required.",
      "any.only": "Invalid authentication method.",
    }),
  code: joi.when("method", {
    is: "passkey",
    then: passkeyPayloadSchema.required().messages({
      "any.required": "passkey payload is required.",
    }),
    otherwise: joi.when("method", {
      is: joi.valid("password", "security_code"),
      then: joi.string().trim().min(1).required().messages({
        "any.required": "code is required for this method.",
        "string.empty": "code cannot be empty.",
      }),
      otherwise: joi.string().allow("").allow(null).optional(),
    }),
  }),
  deviceId: joi.string().required().messages({
    "any.required": "deviceId is required.",
    "string.empty": "deviceId cannot be empty.",
  }),
  deviceSize: joi.number(),
  remember: joi.boolean().valid(true, false).required().messages({
    "any.only": "Invalid remember type only allowed true or false.",
    "any.required": "remember is required.",
  }),
});
