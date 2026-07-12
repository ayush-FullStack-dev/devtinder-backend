import express from "express";

// importing handlers
import {
  loginIdentifyHandler,
  verifyLoginHandler,
} from "../controllers/auth/login.controller.js";
import {
  signupHandler,
  verifyEvl,
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
  handleStepUpIfNeeded,
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

const router = express.Router();

// all route where need to authenticate
router.use(
  "/manage/",
  validateBasicInfo,
  isLogin,
  findLoginData,
  rateLimiter({
    limit: 60,
    window: 10,
    block: 5,
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
    limit: 60,
    window: 10,
    block: 5,
    route: "mfa:manage:base",
  }),
  verifedMfaUser,
);

router.use(
  "/account/",
  isLogin,
  findLoginData,
  rateLimiter({
    limit: 40,
    window: 5,
    block: 5,
    route: "account",
  }),
);

// Create new user
router.post(
  "/signup/",
  rateLimiter({ limit: 10, window: 60, block: 10, route: "signup" }),
  signupValidation,
  signupHandler,
);

router.get(
  "/verify/",
  rateLimiter({ limit: 20, window: 60, block: 5, route: "verify" }),
  verifyEvl,
);

// login to exting info
router.post(
  "/login/identify/",
  validateBasicInfo,
  rateLimiter({ limit: 30, window: 10, block: 10, route: "login:identify" }),
  loginIdentifyValidation,
  loginIdentifyHandler,
);

router.post(
  "/login/confirm/",
  validateBasicInfo,
  rateLimiter({ limit: 30, window: 10, block: 5, route: "login:confirm" }),
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
  rateLimiter({ limit: 10, window: 60, block: 10, route: "2fa:start" }),
  twoFAValidation,
  startTwoFAHandler,
);

router.post(
  "/verify-2fa/resend/",
  rateLimiter({ limit: 10, window: 60, block: 15, route: "2fa:resend" }),
  twoFAValidation,
  resendOtpHandler,
);

router.post(
  "/verify-2fa/confirm/",
  rateLimiter({ limit: 10, window: 60, block: 15, route: "2fa:confirm" }),
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
  rateLimiter({ limit: 20, window: 60, block: 10, route: "refresh" }),
  validateRefreshToken,
  bindTokenToDevice,
  reEvaluateRisk,
  handleStepUpIfNeeded,
  rotateRefreshToken,
  issueNewTokens,
);

// logout exsiting sessions
router.post(
  "/logout/",
  validateBasicInfo,
  isLogin,
  findLoginData,
  rateLimiter({ limit: 10, window: 60, block: 5, route: "logout" }),
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
  rateLimiter({ limit: 5, window: 60, block: 10, route: "logout:all" }),
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
  rateLimiter({ limit: 20, window: 60, block: 5, route: "session:list" }),
  sessionHandler,
);

router.get(
  "/me",
  isLogin,
  rateLimiter({ limit: 150, window: 5, block: 3, route: "account:me" }),
  accountInfo,
);

router.post(
  "/session/revoke/:id/",
  isLogin,
  findLoginData,
  rateLimiter({ limit: 10, window: 60, block: 10, route: "session:revoke" }),
  sessionRevokeHandler,
);

// password releted routes
router.post(
  "/change-password/start/",
  validateBasicInfo,
  isLogin,
  findLoginData,
  rateLimiter({ limit: 5, window: 60, block: 15, route: "password:start" }),
  verifyIdentifyHandler,
);

router.post(
  "/change-password/confirm/",
  validateBasicInfo,
  isLogin,
  findLoginData,
  rateLimiter({ limit: 5, window: 60, block: 20, route: "password:confirm" }),
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
  rateLimiter({ limit: 10, window: 300, block: 30, route: "password:forgot" }),
  forgotPasswordHandler,
);

router
  .route("/reset-password/:token/")
  .get(
    rateLimiter({
      limit: 10,
      window: 60,
      block: 10,
      route: "password:reset:get",
    }),
    resetPasswordValidation,
  )
  .post(
    rateLimiter({
      limit: 5,
      window: 60,
      block: 20,
      route: "password:reset:post",
    }),
    resetPasswordHandler,
  );

// twoFA releted routes
router.post(
  "/mfa/start/",
  isLogin,
  findLoginData,
  rateLimiter({ limit: 5, window: 60, block: 10, route: "mfa:start" }),
  verifyIdentifyHandler,
);

router.post(
  "/mfa/verify/",
  isLogin,
  findLoginData,
  rateLimiter({ limit: 5, window: 60, block: 15, route: "mfa:verify" }),
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
      limit: 10,
      window: 5,
      block: 10,
      route: "approve_login",
    }),
    sessionApprovealHandler,
  );

router.get("/account/security-events/", securityEventHandler);
router.get("/account/active-risks/", activeRiskHandler);

export default router;
