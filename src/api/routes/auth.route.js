import express from "express";

// importing handlers
import {
  loginIdentifyHandler,
  verifyLoginHandler,
} from "../controllers/auth/login.controller.js";
import {
  signupHandler,
  verifyEvl,
  resendVerificationHandler,
} from "../controllers/auth/signup.controller.js";
import {
  startTwoFAHandler,
  verifyTwoFAHandler,
  resendOtpHandler,
} from "../controllers/auth/twoFA.controller.js";
import { issueNewTokens } from "../controllers/auth/refresh.controller.js";
import { sendLogoutResponse } from "../controllers/auth/logout.controller.js";
import {
  sessionHandler,
  sessionRevokeHandler,
} from "../controllers/auth/session.controller.js";
import {
  checkEmail,
  checkUsername,
  verifyIdentifyHandler,
  verifyVerificationHandler,
} from "../controllers/auth/auth.controller.js";
import {
  changePasswordHandler,
  forgotPasswordHandler,
  resetPasswordValidation,
  resetPasswordHandler,
} from "../controllers/auth/password.controller.js";
import {
  manageMfaHandler,
  enableTwoFA,
} from "../controllers/auth/mfa/mfa.controller.js";
import {
  renewBackupCodeHandler,
  addBackupCodeHandler,
  activeBackupCodeHandler,
  deleteBackupCodeHandler,
} from "../controllers/auth/mfa/backupcodes.controller.js";
import {
  activeTotpHandler,
  addTotpHandler,
  renewTotpHandler,
  deleteTotpHandler,
} from "../controllers/auth/mfa/totp.controller.js";
import {
  activeMailsHandler,
  addNewMailHandler,
  verifyMailHandler,
  revokeMailHandler,
  resendOtpMfaHandler,
} from "../controllers/auth/mfa/email.controller.js";
import { createSecurtyCode } from "../controllers/auth/securityCode.controller.js";
import {
  activePasskeysHandler,
  addNewPasskeyHandler,
  editPasskeyHandler,
  deletePasskeyHandler,
} from "../controllers/auth/passkey.controller.js";
import {
  sessionApprovealHandler,
  sessionApprovealInfo,
} from "../controllers/auth/sessionApproval.controller.js";
import {
  revokeTrustedDevice,
  getAllTrustedDevice,
} from "../controllers/auth/trusted.controller.js";
import {
  securityEventHandler,
  activeRiskHandler,
  accountInfo,
} from "../controllers/auth/account.controller.js";
import {
  reauthIdentifyHandler,
  verifyReauthHandler,
} from "../controllers/auth/reauth.controller.js";
import {
  isValidReauthSession,
  findReauthData,
} from "../../middlewares/auth/reauth.middleware.js";

// importing middleware
import { signupValidation } from "../../middlewares/auth/signup.middleware.js";
import { loginIdentifyValidation } from "../../middlewares/auth/login.middleware.js";
import { twoFAValidation } from "../../middlewares/auth/twoFA.middleware.js";
import {
  verifyLoginValidation,
  verifyLoginTrustDevice,
  verifyLoginPasskey,
  verifyLoginPassword,
  verifyLoginSessionApproval,
  verifyLoginSecurityCode,
  verifyLoginFallback,
} from "../../middlewares/auth/verifyLogin.middleware.js";
import {
  verifyTwoFAValidation,
  verifyTwoFAEmail,
  verifyTwoFATotp,
  verifyTwoFABackupcode,
} from "../../middlewares/auth/verifyTwoFA.middleware.js";
import {
  extractRefreshToken,
  validateRefreshToken,
  bindTokenToDevice,
  reEvaluateRisk,
  handleRefreshReauth,
  rotateRefreshToken,
} from "../../middlewares/auth/refresh.middleware.js";
import {
  extractLogoutInfo,
  validateLogout,
  logoutAllSession,
  logoutCurrentSession,
} from "../../middlewares/auth/logout.middleware.js";
import {
  isLogin,
  findLoginData,
  validateBasicInfo,
} from "../../middlewares/auth/auth.middleware.js";
import {
  verifyVerifaction,
  verifedMfaUser,
} from "../../middlewares/auth/verifyAuth.middleware.js";
import { rateLimiter } from "../../middlewares/auth/security.middleware.js";
import { AUTH_LIMITS } from "../../constants/rateLimit.constant.js";

const router = express.Router();

// all route where need to authenticate
router.use(
  "/manage/",
  validateBasicInfo,
  isLogin,
  findLoginData,
  rateLimiter({
    limit: AUTH_LIMITS["manage:base"].maxRequests,
    window: AUTH_LIMITS["manage:base"].windowMinutes,
    block: AUTH_LIMITS["manage:base"].blockMinutes,
    route: "manage:base",
  }),
  verifedMfaUser,
);

router.use(
  "/mfa/manage/",
  validateBasicInfo,
  isLogin,
  findLoginData,
  rateLimiter({
    limit: AUTH_LIMITS["mfa:manage:base"].maxRequests,
    window: AUTH_LIMITS["mfa:manage:base"].windowMinutes,
    block: AUTH_LIMITS["mfa:manage:base"].blockMinutes,
    route: "mfa:manage:base",
  }),
  verifedMfaUser,
);

router.use(
  "/account/",
  isLogin,
  findLoginData,
  rateLimiter({
    limit: AUTH_LIMITS["account"].maxRequests,
    window: AUTH_LIMITS["account"].windowMinutes,
    block: AUTH_LIMITS["account"].blockMinutes,
    route: "account",
  }),
);

// Create new user
router.post(
  "/signup/",
  rateLimiter({
    limit: AUTH_LIMITS["signup"].maxRequests,
    window: AUTH_LIMITS["signup"].windowMinutes,
    block: AUTH_LIMITS["signup"].blockMinutes,
    route: "signup",
  }),
  signupValidation,
  signupHandler,
);

router.get(
  "/verify/",
  rateLimiter({
    limit: AUTH_LIMITS["verify"].maxRequests,
    window: AUTH_LIMITS["verify"].windowMinutes,
    block: AUTH_LIMITS["verify"].blockMinutes,
    route: "verify",
  }),
  verifyEvl,
);

router.post(
  "/signup/resend-verification/",
  rateLimiter({
    limit: AUTH_LIMITS["signup:resend"].maxRequests,
    window: AUTH_LIMITS["signup:resend"].windowMinutes,
    block: AUTH_LIMITS["signup:resend"].blockMinutes,
    route: "signup:resend",
  }),
  resendVerificationHandler,
);

// login to exting info
router.post(
  "/login/identify/",
  validateBasicInfo,
  rateLimiter({
    limit: AUTH_LIMITS["login:identify"].maxRequests,
    window: AUTH_LIMITS["login:identify"].windowMinutes,
    block: AUTH_LIMITS["login:identify"].blockMinutes,
    route: "login:identify",
  }),
  loginIdentifyValidation,
  loginIdentifyHandler,
);

router.post(
  "/login/confirm/",
  validateBasicInfo,
  rateLimiter({
    limit: AUTH_LIMITS["login:confirm"].maxRequests,
    window: AUTH_LIMITS["login:confirm"].windowMinutes,
    block: AUTH_LIMITS["login:confirm"].blockMinutes,
    route: "login:confirm",
  }),
  verifyLoginValidation, // context + risk
  verifyLoginTrustDevice, // trusted session
  verifyLoginPasskey, // verylow / low / mid / high auto-login or verify
  verifyLoginPassword, // verylow / low / mid / high auto-login or verify
  verifyLoginSessionApproval, // verylow / mid / high / veryhigh auto-login or verify
  verifyLoginSecurityCode, // verylow / mid / high / veryhigh auto-login or verify
  verifyLoginFallback, // fallback: auto-login on verylow or reject
  verifyLoginHandler, // final decision
);

// verify-2fa
router.post(
  "/verify-2fa/start/",
  rateLimiter({
    limit: AUTH_LIMITS["2fa:start"].maxRequests,
    window: AUTH_LIMITS["2fa:start"].windowMinutes,
    block: AUTH_LIMITS["2fa:start"].blockMinutes,
    route: "2fa:start",
  }),
  twoFAValidation,
  startTwoFAHandler,
);

router.post(
  "/verify-2fa/resend/",
  rateLimiter({
    limit: AUTH_LIMITS["2fa:resend"].maxRequests,
    window: AUTH_LIMITS["2fa:resend"].windowMinutes,
    block: AUTH_LIMITS["2fa:resend"].blockMinutes,
    route: "2fa:resend",
  }),
  twoFAValidation,
  resendOtpHandler,
);

router.post(
  "/verify-2fa/confirm/",
  rateLimiter({
    limit: AUTH_LIMITS["2fa:confirm"].maxRequests,
    window: AUTH_LIMITS["2fa:confirm"].windowMinutes,
    block: AUTH_LIMITS["2fa:confirm"].blockMinutes,
    route: "2fa:confirm",
  }),
  verifyTwoFAValidation,
  verifyTwoFAEmail,
  verifyTwoFATotp,
  verifyTwoFABackupcode,
  verifyTwoFAHandler,
);

// get new token
router.post(
  "/refresh/",
  validateBasicInfo,
  extractRefreshToken,
  rateLimiter({
    limit: AUTH_LIMITS["refresh"].maxRequests,
    window: AUTH_LIMITS["refresh"].windowMinutes,
    block: AUTH_LIMITS["refresh"].blockMinutes,
    route: "refresh",
  }),
  validateRefreshToken,
  bindTokenToDevice,
  reEvaluateRisk,
  handleRefreshReauth,
  rotateRefreshToken,
  issueNewTokens,
);
// logout exsiting sessions
router.post(
  "/logout/",
  validateBasicInfo,
  isLogin,
  findLoginData,
  rateLimiter({
    limit: AUTH_LIMITS["logout"].maxRequests,
    window: AUTH_LIMITS["logout"].windowMinutes,
    block: AUTH_LIMITS["logout"].blockMinutes,
    route: "logout",
  }),
  extractLogoutInfo,
  validateLogout,
  logoutCurrentSession,
  sendLogoutResponse,
);

router.post(
  "/logout-all/",
  validateBasicInfo,
  isLogin,
  findLoginData,
  rateLimiter({
    limit: AUTH_LIMITS["logout:all"].maxRequests,
    window: AUTH_LIMITS["logout:all"].windowMinutes,
    block: AUTH_LIMITS["logout:all"].blockMinutes,
    route: "logout:all",
  }),
  extractLogoutInfo,
  validateLogout,
  logoutAllSession,
  sendLogoutResponse,
);

// see all active session & revoke it
router.get(
  "/session/",
  isLogin,
  findLoginData,
  rateLimiter({
    limit: AUTH_LIMITS["session:list"].maxRequests,
    window: AUTH_LIMITS["session:list"].windowMinutes,
    block: AUTH_LIMITS["session:list"].blockMinutes,
    route: "session:list",
  }),
  sessionHandler,
);

router.get(
  "/me",
  isLogin,
  rateLimiter({
    limit: AUTH_LIMITS["account:me"].maxRequests,
    window: AUTH_LIMITS["account:me"].windowMinutes,
    block: AUTH_LIMITS["account:me"].blockMinutes,
    route: "account:me",
  }),
  accountInfo,
);

router.post(
  "/session/revoke/:id/",
  isLogin,
  findLoginData,
  rateLimiter({
    limit: AUTH_LIMITS["session:revoke"].maxRequests,
    window: AUTH_LIMITS["session:revoke"].windowMinutes,
    block: AUTH_LIMITS["session:revoke"].blockMinutes,
    route: "session:revoke",
  }),
  sessionRevokeHandler,
);

// password releted routes
router.post(
  "/change-password/start/",
  validateBasicInfo,
  isLogin,
  findLoginData,
  rateLimiter({
    limit: AUTH_LIMITS["password:start"].maxRequests,
    window: AUTH_LIMITS["password:start"].windowMinutes,
    block: AUTH_LIMITS["password:start"].blockMinutes,
    route: "password:start",
  }),
  verifyIdentifyHandler,
);

router.post(
  "/change-password/confirm/",
  validateBasicInfo,
  isLogin,
  findLoginData,
  rateLimiter({
    limit: AUTH_LIMITS["password:confirm"].maxRequests,
    window: AUTH_LIMITS["password:confirm"].windowMinutes,
    block: AUTH_LIMITS["password:confirm"].blockMinutes,
    route: "password:confirm",
  }),
  verifyVerifaction,
  changePasswordHandler, // chnage password
  verifyLoginPasskey, // verylow / low / mid / high auto-login or verify
  verifyLoginPassword, // verylow / low / mid / high auto-login or verify
  verifyLoginSessionApproval, // verylow / mid / high / veryhigh auto-login or verify
  verifyLoginSecurityCode, // verylow / mid / high / veryhigh auto-login or verify
  verifyLoginFallback, // fallback: auto-login on verylow or reject
  verifyVerificationHandler("change:password", "submit_new_password"),
);

router.post(
  "/forgot-password/",
  rateLimiter({
    limit: AUTH_LIMITS["password:forgot"].maxRequests,
    window: AUTH_LIMITS["password:forgot"].windowMinutes,
    block: AUTH_LIMITS["password:forgot"].blockMinutes,
    route: "password:forgot",
  }),
  forgotPasswordHandler,
);

router
  .route("/reset-password/:token/")
  .get(
    rateLimiter({
      limit: AUTH_LIMITS["password:reset:get"].maxRequests,
      window: AUTH_LIMITS["password:reset:get"].windowMinutes,
      block: AUTH_LIMITS["password:reset:get"].blockMinutes,
      route: "password:reset:get",
    }),
    resetPasswordValidation,
  )
  .post(
    rateLimiter({
      limit: AUTH_LIMITS["password:reset:post"].maxRequests,
      window: AUTH_LIMITS["password:reset:post"].windowMinutes,
      block: AUTH_LIMITS["password:reset:post"].blockMinutes,
      route: "password:reset:post",
    }),
    resetPasswordHandler,
  );

// twoFA releted routes
router.post(
  "/mfa/start/",
  isLogin,
  findLoginData,
  rateLimiter({
    limit: AUTH_LIMITS["mfa:start"].maxRequests,
    window: AUTH_LIMITS["mfa:start"].windowMinutes,
    block: AUTH_LIMITS["mfa:start"].blockMinutes,
    route: "mfa:start",
  }),
  verifyIdentifyHandler,
);

router.post(
  "/mfa/verify/",
  isLogin,
  findLoginData,
  rateLimiter({
    limit: AUTH_LIMITS["mfa:verify"].maxRequests,
    window: AUTH_LIMITS["mfa:verify"].windowMinutes,
    block: AUTH_LIMITS["mfa:verify"].blockMinutes,
    route: "mfa:verify",
  }),
  verifyVerifaction,
  verifyLoginPasskey,
  verifyLoginPassword,
  verifyLoginSessionApproval,
  verifyLoginSecurityCode,
  verifyVerificationHandler("verify:mfa", "/mfa/manage?rpat=", {
    verified: true,
    expiresIn: Date.now() + 300000,
  }),
);

router.route("/mfa/manage/").get(manageMfaHandler).post(enableTwoFA);

router
  .route("/mfa/manage/backupcode/")
  .get(activeBackupCodeHandler)
  .post(addBackupCodeHandler)
  .put(renewBackupCodeHandler)
  .delete(deleteBackupCodeHandler);

router
  .route("/mfa/manage/totp/")
  .get(activeTotpHandler)
  .post(addTotpHandler)
  .patch(renewTotpHandler)
  .delete(deleteTotpHandler);

router
  .route("/mfa/manage/email/")
  .get(activeMailsHandler)
  .post(addNewMailHandler)
  .delete(revokeMailHandler);

router.post("/mfa/manage/email/verify/", verifyMailHandler);
router.post("/mfa/manage/email/resend/", resendOtpMfaHandler);

// mange login methods
router.post("/manage/securitycode/", createSecurtyCode);
router
  .route("/manage/passkey/")
  .get(activePasskeysHandler)
  .post(addNewPasskeyHandler)
  .patch(editPasskeyHandler)
  .delete(deletePasskeyHandler);

router
  .route("/manage/trusted-devices/")
  .get(getAllTrustedDevice)
  .delete(revokeTrustedDevice);

router
  .route("/account/approve-login/:id")
  .get(sessionApprovealInfo)
  .post(
    rateLimiter({
      limit: AUTH_LIMITS["approve_login"].maxRequests,
      window: AUTH_LIMITS["approve_login"].windowMinutes,
      block: AUTH_LIMITS["approve_login"].blockMinutes,
      route: "approve_login",
    }),
    sessionApprovealHandler,
  );

//availability check
router.get(
  "/check-username/",
  rateLimiter({
    limit: AUTH_LIMITS["check:username"].maxRequests,
    window: AUTH_LIMITS["check:username"].windowMinutes,
    block: AUTH_LIMITS["check:username"].blockMinutes,
    route: "check:username",
  }),
  checkUsername,
);

router.get(
  "/check-email/",
  rateLimiter({
    limit: AUTH_LIMITS["check:email"].maxRequests,
    window: AUTH_LIMITS["check:email"].windowMinutes,
    block: AUTH_LIMITS["check:email"].blockMinutes,
    route: "check:email",
  }),
  checkEmail,
);

router.get("/account/security-events/", securityEventHandler);
router.get("/account/active-risks/", activeRiskHandler);

router.post(
  "/reauth/identify/",
  validateBasicInfo,
  rateLimiter({
    limit: AUTH_LIMITS["reauth:identify"].maxRequests,
    window: AUTH_LIMITS["reauth:identify"].windowMinutes,
    block: AUTH_LIMITS["reauth:identify"].blockMinutes,
    route: "reauth:identify",
  }),
  reauthIdentifyHandler,
);

router.post(
  "/reauth/confirm/",
  validateBasicInfo,
  rateLimiter({
    limit: AUTH_LIMITS["reauth:confirm"].maxRequests,
    window: AUTH_LIMITS["reauth:confirm"].windowMinutes,
    block: AUTH_LIMITS["reauth:confirm"].blockMinutes,
    route: "reauth:confirm",
  }),
  isValidReauthSession,
  findReauthData,
  verifyLoginValidation,
  verifyLoginPasskey,
  verifyLoginPassword,
  verifyLoginSessionApproval,
  verifyLoginSecurityCode,
  verifyLoginFallback,
  verifyReauthHandler,
);

export default router;
