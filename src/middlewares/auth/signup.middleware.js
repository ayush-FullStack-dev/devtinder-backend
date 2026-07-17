import signupValidators from "../../validators/auth/signup.validator.js";
import { checkValidation } from "../../helpers/helpers.js";
import sendResponse from "../../helpers/sendResponse.js";

import { findUser } from "../../services/user.service.js";

export const signupValidation = async (req, res, next) => {
  req.body.gender = req.body.gender || "male";
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
    $or: [{ email: req.body.email }, { username: req.body.username }],
  });

  if (existingUser) {
    const emailTaken = existingUser.email === req.body.email;
    const usernameTaken = existingUser.username === req.body.username;

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

  if (req.body.email === process.env.ADMIN_MAIL) {
    req.body.role = "admin";
  }

  return next();
};
