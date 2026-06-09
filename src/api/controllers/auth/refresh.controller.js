import { removeCookie } from "../../../helpers/sendResponse.js";
import { updateUser } from "../../../services/user.service.js";

import { cookieOption } from "../../../constants/auth.constant.js";

import {
  logoutAllSession,
  logoutCurrentSession,
} from "../../../middlewares/auth/logout.middleware.js";

export const issueNewTokens = async (req, res, next) => {
  const { user, verify, token, refreshToken, accessToken } = req.auth;
  req.auth.device = token;
  req.auth.reason = "security_risk";
  if (verify?.action === "logout-all") {
    await logoutAllSession(req);

    return res
      .clearCookie("accessToken", cookieOption)
      .clearCookie("refreshToken", cookieOption)
      .clearCookie("trustedSession", cookieOption)
      .clearCookie("trustedDeviceId", cookieOption)
      .status(401)
      .json({
        success: false,
        message: verify?.message,
        logout: verify?.action,
      });
  } else if (verify?.action === "logout") {
    const info = await logoutCurrentSession(req);
    return res
      .clearCookie("accessToken", cookieOption)
      .clearCookie("refreshToken", cookieOption)
      .clearCookie("trustedSession", cookieOption)
      .clearCookie("trustedDeviceId", cookieOption)
      .status(401)
      .json({
        ...info,
        message: verify?.message,
      });
  }

  await updateUser(
    {
      _id: user._id,
    },
    {
      refreshToken: user.refreshToken,
    },
  );

  res
    .status(200)
    .cookie("accessToken", accessToken, cookieOption)
    .cookie("refreshToken", refreshToken, cookieOption)
    .json({
      success: true,
      message: "Refresh token successfully",
    });
};
