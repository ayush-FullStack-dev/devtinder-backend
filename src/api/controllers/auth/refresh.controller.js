import { removeCookie } from "../../../helpers/sendResponse.js";
import { updateUser } from "../../../services/user.service.js";

import { cookieOption, accessTokenCookieOption, refreshTokenCookieOption } from "../../../constants/auth.constant.js";

import {
  logoutAllSession,
  logoutCurrentSession,
} from "../../../middlewares/auth/logout.middleware.js";

export const issueNewTokens = async (req, res, next) => {
  const { user, verify, token, refreshToken, accessToken, refreshMaxAge } = req.auth;
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
        action: "logout-all",
        message: verify?.message,
      });
  }

  if (verify?.action === "logout") {
    const info = await logoutCurrentSession(req);
    return res
      .clearCookie("accessToken", cookieOption)
      .clearCookie("refreshToken", cookieOption)
      .clearCookie("trustedSession", cookieOption)
      .clearCookie("trustedDeviceId", cookieOption)
      .status(401)
      .json({
        success: false,
        action: "logout",
        message: verify?.message,
        ...info,
      });
  }

  await updateUser({ _id: user._id }, { refreshToken: user.refreshToken });

  return res
    .status(200)
    .cookie("accessToken", accessToken, accessTokenCookieOption)
    .cookie("refreshToken", refreshToken, refreshTokenCookieOption(refreshMaxAge))
    .json({
      success: true,
      action: "token_refreshed",
      message: "Session refreshed successfully.",
    });
};
