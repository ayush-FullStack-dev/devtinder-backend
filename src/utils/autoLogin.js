import { buildDeviceInfo } from "../helpers/buildDeviceInfo.js";
import { getIpDetails } from "../helpers/ip.js";
import { setRefreshExpiry } from "../helpers/helpers.js";
import { issueTokens } from "./issueTokens.js";
import {
  accessTokenCookieOption,
  refreshTokenCookieOption,
  trustedSessionCookieOption,
} from "../constants/auth.constant.js";

const AUTO_LOGIN_INFO = {
  risk: "verylow",
  riskScore: 0,
};

const AUTO_LOGIN_VERIFY = {
  success: true,
  method: "trusted_session",
};

/**
 * Issues tokens and sends login cookies+response after signup/verification.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {object} user - Mongoose user document
 */
export const autoLogin = async (req, res, user) => {
  const ipDetails = await getIpDetails(req.realIp);
  const deviceInfo = buildDeviceInfo(req.headers["user-agent"], {}, ipDetails);
  const refreshExpiry = setRefreshExpiry({ remember: true });

  const userInfo = {
    ...deviceInfo,
    loginContext: {
      primary: { method: "trusted_session" },
      mfa: { required: false, complete: true, methodsUsed: "none" },
      trust: { deviceTrusted: true, sessionLevel: "verylow" },
    },
  };

  const { accessToken, refreshToken, trustedSession, updatedUser } = await issueTokens({
    user,
    deviceInfo,
    verify: AUTO_LOGIN_VERIFY,
    info: AUTO_LOGIN_INFO,
    refreshExpiry,
    userInfo,
  });

  return res
    .status(200)
    .cookie("accessToken", accessToken, accessTokenCookieOption)
    .cookie("refreshToken", refreshToken, refreshTokenCookieOption(refreshExpiry.ms))
    .cookie("trustedSession", trustedSession, trustedSessionCookieOption)
    .json({
      success: true,
      code: "LOGIN_SUCCESS",
      message: "User login successfully",
      data: {
        name: updatedUser.name,
        email: updatedUser.email,
        picture: updatedUser.picture,
      },
    });
};
