import { signToken } from "./jwt.js";
import { verifyToken } from "./jwt.js";

export function getAccessToken(user) {
  return signToken(
    {
      _id: user._id,
      name: user.name,
      email: user.email,
      picture: user.picture,
      role: user.role,
      age: user.age,
      gender: user.gender,
    },
    "30m",
  );
}

export function getRefreshToken(data, expiry = "30d") {
  return signToken(data, expiry);
}

export function verifyRefreshToken(token) {
  const decodeData = verifyToken(token);

  if (!decodeData.success) {
    return {
      success: false,
      message: "Session expired, please login again",
    };
  }

  return {
    success: true,
    message: decodeData.message,
    data: decodeData.data,
  };
}

export function verifyAccesToken(token) {
  const decodeData = verifyToken(token);

  if (!decodeData.success) {
    return {
      success: false,
      message: "Session expired, please refresh now",
    };
  }

  return {
    success: true,
    message: decodeData.message,
    data: decodeData.data,
  };
}
