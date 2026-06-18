import sendResponse from "../../helpers/sendResponse.js";

import { findUser } from "../../services/user.service.js";
import { verifyAccesToken } from "../../helpers/token.js";

export const isLogin = (req, res, next) => {
  const accessToken = req.signedCookies?.accessToken;
  const refreshToken = req.signedCookies?.refreshToken;
  const data = verifyAccesToken(accessToken);

  if (!accessToken) {
    return sendResponse(res, 401, {
      message: "Login required to access this resource.",
      code: "login_required",
    });
  }

  if (!data?.success) {
    return sendResponse(res, 401, {
      message: data.message,
      code: "refresh_auth_token",
    });
  }

  req.auth = {
    ...req.auth,
    info: data?.data,
    refreshToken,
  };
  return next();
};

export const findLoginData = async (req, res, next) => {
  const { info, refreshToken } = req.auth;

  const user = await findUser({
    _id: info?._id,
  });

  if (!user) {
    return sendResponse(res, 401, {
      message: "AccessToken is invalid please login again.",
      code: "relogin_required",
    });
  }

  const findedToken = user.refreshToken.find((k) => k.token === refreshToken);

  req.auth.findedCurrent = findedToken;
  req.auth.user = user;
  return next();
};

export const validateBasicInfo = (req, res, next) => {
  if (req?.body) {
    const { clientTimestamp, deviceId, deviceSize } = req.body;

    if (!clientTimestamp) {
      return sendResponse(res, 400, "Client timestamp is required");
    }

    if (!deviceId || deviceId.length !== 32) {
      return sendResponse(
        res,
        400,
        "Invalid deviceId. Must be exactly 32 characters",
      );
    }

    if (!deviceSize) {
      return sendResponse(res, 400, "Device size is required (width + height)");
    }

    if (deviceSize <= 170 && deviceSize >= 4000) {
      return sendResponse(res, 400, "Device size is out of allowed range");
    }

    req.body.clientTime = clientTimestamp;
    return next();
  }

  const { clientTimestamp, deviceid, devicesize } = req.headers;

  if (!clientTimestamp) {
    return sendResponse(res, 400, "Client timestamp is required");
  }

  if (!deviceid || deviceid.length !== 32) {
    return sendResponse(
      res,
      400,
      "Invalid deviceId. Must be exactly 32 characters",
    );
  }

  if (!devicesize) {
    return sendResponse(res, 400, "Device size is required (width + height)");
  }

  if (devicesize >= 170 && devicesize <= 3000) {
    return sendResponse(res, 400, "Device size is out of allowed range");
  }

  req.body = {
    ...req.body,
    clientTime: clientTimestamp,
    deviceId: deviceid,
    deviceSize: devicesize,
  };

  return next();
};
