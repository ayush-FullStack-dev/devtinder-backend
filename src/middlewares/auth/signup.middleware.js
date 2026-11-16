import signupValidators, {
  verifySignupValidator,
} from "../../validators/auth/signup.validator.js";
import { checkValidation } from "../../helpers/helpers.js";
import sendResponse from "../../helpers/sendResponse.js";

import { findUser } from "../../services/user.service.js";
import { buildDeviceInfo } from "../../helpers/buildDeviceInfo.js";
import { getIpDetails } from "../../helpers/ip.js";

export const verifySignupValidation = async (req, res, next) => {
  const validate = checkValidation(
    verifySignupValidator,
    req,
    "Device information is required to complete verification",
  );

  if (!validate.success) {
    return sendResponse(res, 400, validate.jsonResponse);
  }

  const userAgent = req.headers["user-agent"];
  if (typeof userAgent !== "string" || !userAgent.trim()) {
    return sendResponse(
      res,
      400,
      "User-Agent is required to complete verification",
    );
  }

  req.auth = {
    deviceInfo: buildDeviceInfo(
      userAgent,
      { ...validate.value, clientTime: validate.value.clientTimestamp },
      await getIpDetails(req.realIp),
    ),
  };
  return next();
};

export const signupValidation = async (req, res, next) => {
  req.body.role = "user";

  const validate = checkValidation(
    signupValidators,
    req,
    "vaildation failed for register",
  );

  if (!validate?.success) {
    return sendResponse(res, 400, validate.jsonResponse);
  }

  const existingUser = await findUser({
    $or: [{ email: req.body.email.trim().toLowerCase() }, { username: req.body.username.trim().toLowerCase() }],
  });

  if (existingUser) {
    const emailTaken = existingUser.email === req.body.email.trim().toLowerCase();
    const usernameTaken = existingUser.username === req.body.username.trim().toLowerCase();

    if (emailTaken && usernameTaken) {
      return sendResponse(res, 401, {
        message: `${req.body.email} email && ${req.body.username} username are already taken`,
      });
    }

    if (emailTaken) {
      return sendResponse(res, 401, {
        message: `${req.body.email} email is already taken`,
      });
    }

    if (usernameTaken) {
      return sendResponse(res, 401, {
        message: `${req.body.username} username is already taken`,
      });
    }
  }

  if (req.body.email.trim().toLowerCase() === process.env.ADMIN_MAIL) {
    req.body.role = "admin";
  }

  return next();
};
