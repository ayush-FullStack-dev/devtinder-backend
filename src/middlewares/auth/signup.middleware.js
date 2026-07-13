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

  const emailExist = await findUser({
    email: req.body.email,
  });

  if (emailExist && emailExist.username === req.body.username) {
    return sendResponse(res, 401, {
      message: `${emailExist.email} email && ${emailExist.username} is already taken use different email && username to signup`,
    });
  } else if (emailExist) {
    return sendResponse(res, 401, {
      message: `${req.body.email} email is already taken use different email to signup`,
    });
  }

  const usernameExist = await findUser({
    username: req.body.username,
  });

  if (usernameExist) {
    return sendResponse(res, 401, {
      message: `${usernameExist.username} username is already taken use different username to signup`,
    });
  }

  if (req.body.email === process.env.ADMIN_MAIL) {
    req.body.role = "admin";
  }


  return next();
};
