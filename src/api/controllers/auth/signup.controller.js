import crypto from "crypto";

import ApiError from "../../../helpers/ApiError.js";
import sendResponse from "../../../helpers/sendResponse.js";
import { generateHash } from "../../../helpers/hash.js";
import { sendVerifyLink } from "../../../helpers/mail.js";

import {
  createOrUpdatePendingUser,
  findPendingUser,
  deletePendingUser,
  createUser,
} from "../../../services/user.service.js";
import { autoLogin } from "../../../utils/autoLogin.js";

export const signupHandler = async (req, res) => {
  let { name, email, username, password, gender, role } = req.body;

  const verificationToken = crypto
    .randomBytes(Number(process.env.BYTE))
    .toString("hex");

  password = await generateHash(password);

  const userData = await createOrUpdatePendingUser({
    name,
    email,
    username,
    password,
    role,
    gender,
    token: verificationToken,
  });

  sendVerifyLink(email, verificationToken);

  return sendResponse(res, 200, {
    message: "Verification Link Send Succesfull",
    data: {
      name: userData.name,
      email: userData.email,
      username: userData.username,
    },
  });
};

export const verifyEvl = async (req, res) => {
  const token = req.query.token;

  if (!token) {
    throw new ApiError("BadRequest", " Token is not found in query", 400);
  }

  if (token.length !== Number(process.env.BYTE) * 2) {
    throw new ApiError("BadRequest", " Token is invalid or corrupted", 400);
  }

  const findData = await findPendingUser({ token });

  if (!findData) {
    throw new ApiError(
      "UnauthorizedError",
      "Verify Token is invalid or expired",
      401,
    );
  }

  const userData = await createUser({
    name: findData.name,
    email: findData.email,
    username: findData.username,
    password: findData.password,
    role: findData.role,
    gender: findData.gender,
  });

  await deletePendingUser(findData._id, { id: true });

  return autoLogin(req, res, userData);
};
