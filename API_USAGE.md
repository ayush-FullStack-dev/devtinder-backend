# DevTinder — Full API Reference

> Base URL: `/` (no `/api` prefix — routes mount directly)
> All responses follow: `{ success, message, data }`
> Auth via signed cookies: `accessToken` + `refreshToken`

---

## Common Status Codes

| Code | Meaning |
|-----:|---------|
| 200 | Success |
| 201 | Created |
| 202 | Accepted (pending action) |
| 400 | Validation / Bad Request |
| 401 | Unauthorized / Token expired |
| 403 | Forbidden (tier or permission) |
| 404 | Not Found |
| 409 | Conflict |
| 410 | Gone (match/chat closed) |
| 429 | Rate Limited |
| 503 | Service Unavailable |

---

## Tier Tags

| Tag | Meaning |
|-----|---------|
| 🆓 FREE | Any logged-in user |
| 🥈 SILVER | Active Silver or Gold subscription |
| 🥇 GOLD | Active Gold subscription only |
| 🌐 PUBLIC | No login required |

---

## Middleware Reference

| Middleware | What it does |
|-----------|-------------|
| `validateBasicInfo` | Requires `deviceId` (32 chars), `deviceSize`, `clientTimestamp` in body or headers |
| `isLogin` | Verifies `accessToken` cookie. Returns `401` with `code: refresh_auth_token` if expired |
| `findLoginData` | Loads full user from DB using token payload |
| `isProfileExists` | Loads profile from DB. Returns `404` if no profile — redirect to `/profile/setup` |
| `checkPremiumStatus` | Auto-expires subscription if past `expiresAt`, cascades to next plan if available |
| `isPremiumUser()` | Blocks if no active subscription. `isPremiumUser({ gold: true })` blocks non-gold |
| `isProfileBlocked` | Loads target profile by `:username`. Returns `404` if blocked or hidden |
| `rateLimiter(config)` | Redis-based sliding window rate limiter per route per user |
| `verifedMfaUser` | Requires MFA to be fully verified before accessing MFA manage routes |

---

## Error Fix Guide

| Error | Cause | Fix |
|-------|-------|-----|
| `code: refresh_auth_token` | `accessToken` expired | Call `POST /auth/refresh/` |
| `code: relogin_required` | User deleted or token invalid | Force logout, redirect to login |
| `code: login_required` | No `refreshToken` cookie | Redirect to login |
| `PROFILE_NOT_FOUND` + `next: create_profile` | Profile doesn't exist | Redirect to `POST /profile/setup` |
| `PREMIUM_REQUIRED` | Feature needs Silver/Gold | Show upgrade screen |
| `DISCOVER_BATCH_ACTIVE` | Batch already open | Call `GET /discover/old` first |
| `UPLOAD_NOT_FOUND` | S3 key not uploaded yet | Upload to `uploadUrl` first, then confirm |
| `429` on any route | Rate limit hit | Backoff and retry |

---

# AUTH

> Base: `/auth`

---

### POST `/auth/signup/` 🌐

**Middleware:** `rateLimiter(10/60min)` → `signupValidation`

**Body:**
```json
{
  "name": "Ayush",
  "email": "ayush@example.com",
  "username": "ayush_dev",
  "password": "Secret@123",
  "gender": "male",
  "role": "developer",
  "deviceId": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "deviceSize": 1080,
  "clientTimestamp": "2024-01-01T00:00:00.000Z"
}
```

**Success 200:**
```json
{
  "success": true,
  "message": "Verification Link Send Succesfull",
  "data": { "name": "Ayush", "email": "ayush@example.com", "username": "ayush_dev" }
}
```

**Errors:**
| Status | Cause |
|--------|-------|
| 400 | Validation failed (missing fields, weak password) |
| 409 | Email or username already exists |

**Flow:** Sends verification email → user clicks link → `GET /auth/verify/?token=...` → auto-login sets cookies.

---

### GET `/auth/verify/?token=<token>` 🌐

**Middleware:** `rateLimiter(20/60min)`

**Query:** `token` — hex string from email link

**Success:** Sets `accessToken`, `refreshToken`, `trustedSession` cookies. Returns user info.

**Errors:**
| Status | Cause |
|--------|-------|
| 400 | Token missing or wrong length |
| 401 | Token expired or invalid |

---

### POST `/auth/login/identify/` 🌐

**Middleware:** `validateBasicInfo` → `rateLimiter(30/10min)` → `loginIdentifyValidation`

**Body:**
```json
{
  "email": "ayush@example.com",
  "deviceId": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "deviceSize": 1080,
  "clientTimestamp": "2024-01-01T00:00:00.000Z"
}
```

**Success 200:**
```json
{
  "success": true,
  "data": {
    "riskLevel": "low",
    "allowedMethod": ["password", "passkey"],
    "stepUp": false
  }
}
```
Sets `login_ctx` cookie.

**Errors:**
| Status | Cause |
|--------|-------|
| 400 | Missing deviceId / clientTimestamp |
| 401 | Email not found |
| 403 | `veryhigh` risk + no 2FA — security upgrade required |

---

### POST `/auth/login/confirm/` 🌐

**Middleware:** `validateBasicInfo` → `rateLimiter(30/10min)` → full verify chain

**Body:**
```json
{
  "email": "ayush@example.com",
  "password": "Secret@123",
  "deviceId": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "deviceSize": 1080,
  "clientTimestamp": "2024-01-01T00:00:00.000Z"
}
```

**Success 200:** Sets `accessToken`, `refreshToken`, `trustedSession` cookies.
```json
{
  "success": true,
  "code": "LOGIN_SUCCESS",
  "message": "User login successfully",
  "data": { "name": "Ayush", "email": "ayush@example.com", "picture": "..." }
}
```

**Step-up 401 (2FA required):**
```json
{
  "success": false,
  "error": "STEP_UP_REQUIRED",
  "action": "TRY_ANOTHER_VERIFICATION_METHOD"
}
```
Sets `twoFA_ctx` cookie → proceed to `/auth/verify-2fa/start/`

**Errors:**
| Status | Cause |
|--------|-------|
| 401 | Wrong password / method not found |
| 403 | Step-up required |

---

### POST `/auth/verify-2fa/start/` 🌐

**Middleware:** `rateLimiter(10/60min)` → `twoFAValidation`

Requires `twoFA_ctx` cookie.

**Body:**
```json
{
  "email": "ayush@example.com",
  "loginMethod": "EMAIL",
  "deviceId": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "deviceSize": 1080,
  "clientTimestamp": "2024-01-01T00:00:00.000Z"
}
```

`loginMethod` options: `EMAIL` | `TOTP` | `BACKUPCODE`

**Success 200:**
```json
{
  "success": true,
  "message": "Otp send Succesfull",
  "route": "/auth/verify-2fa/confirm",
  "requireCode": true
}
```

**Errors:**
| Status | Cause |
|--------|-------|
| 401 | 2FA session expired, invalid method, or high-risk + backup code |

---

### POST `/auth/verify-2fa/resend/` 🌐

**Middleware:** `rateLimiter(10/60min)` → `twoFAValidation`

Requires `twoFA_ctx` cookie. Only works for `EMAIL` method.

**Body:** Same as start (email + deviceId + deviceSize + clientTimestamp)

**Success 200:** `{ "message": "Otp resend Succesfull" }`

---

### POST `/auth/verify-2fa/confirm/` 🌐

**Middleware:** `rateLimiter(10/60min)` → full 2FA verify chain

Requires `twoFA_ctx` cookie.

**Body:**
```json
{
  "email": "ayush@example.com",
  "code": "123456",
  "trustDevice": true,
  "rememberDevice": true,
  "deviceId": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "deviceSize": 1080,
  "clientTimestamp": "2024-01-01T00:00:00.000Z"
}
```

**Success 200:** Sets all auth cookies. Returns user info.

**Errors:**
| Status | Cause |
|--------|-------|
| 401 | Wrong OTP / TOTP / backup code |

---

### POST `/auth/refresh/` 🌐

**Middleware:** `validateBasicInfo` → `extractRefreshToken` → `rateLimiter(20/60min)` → full refresh chain

**Body:** deviceId + deviceSize + clientTimestamp

**Success 200:** Rotates `accessToken` + `refreshToken` cookies.
```json
{ "success": true, "action": "token_refreshed", "message": "Session refreshed successfully." }
```

**Force logout responses:**
```json
{ "success": false, "action": "logout-all", "message": "..." }
{ "success": false, "action": "logout", "message": "..." }
```
Clears all cookies when security risk detected.

**Errors:**
| Status | Cause |
|--------|-------|
| 401 | Refresh token invalid / expired / revoked |

---

### POST `/auth/logout/` 🆓

**Middleware:** `validateBasicInfo` → `isLogin` → `findLoginData` → `rateLimiter(10/60min)` → logout chain

**Body:** deviceId + deviceSize + clientTimestamp

**Success 200:** Clears `accessToken` + `refreshToken` cookies.
```json
{ "success": true, "message": "You have been signed out", "id": "s_xxxxxxxx" }
```

---

### POST `/auth/logout-all/` 🆓

**Middleware:** Same as logout + `rateLimiter(5/60min)`

**Success 200:** Clears all cookies, invalidates all sessions.
```json
{ "success": true, "message": "You've been signed out from all devices." }
```

---

### GET `/auth/session/` 🆓

**Middleware:** `isLogin` → `findLoginData` → `rateLimiter(20/60min)`

**Success 200:**
```json
{
  "sessions": [
    {
      "id": "s_ab12cd34",
      "device": { "name": "Chrome on Windows", "type": "desktop" },
      "location": { "country": "IN", "city": "Mumbai" },
      "login": { "method": "password", "mfa": false },
      "trust": { "trusted": true, "level": "low" },
      "activity": { "createdAt": "...", "lastActive": "..." },
      "current": true
    }
  ]
}
```

---

### POST `/auth/session/revoke/:id/` 🆓

**Middleware:** `isLogin` → `findLoginData` → `rateLimiter(10/60min)`

**Params:** `:id` — masked session id like `s_ab12cd34`

**Success 200:** `{ "revoked": true, "message": "Session has been signed out" }`

**Errors:**
| Status | Cause |
|--------|-------|
| 400 | Invalid session id format |
| 401 | Cannot revoke current session |
| 404 | Session not found |

---

### GET `/auth/me` 🆓

**Middleware:** `isLogin` → `rateLimiter(150/5min)`

**Success 200:**
```json
{
  "isLoggedIn": true,
  "user": { "id": "...", "name": "Ayush", "email": "ayush@example.com" },
  "profile": {
    "exists": true,
    "username": "ayush_dev",
    "...": "full profile object"
  }
}
```

If no profile:
```json
{
  "profile": { "exists": false, "next": "create_profile", "route": "/profile/setup" }
}
```

---

### POST `/auth/change-password/start/` 🆓

**Middleware:** `validateBasicInfo` → `isLogin` → `findLoginData` → `rateLimiter(5/60min)`

Initiates identity verification before password change. Sets `verify_ctx` cookie.

---

### POST `/auth/change-password/confirm/` 🆓

**Middleware:** `validateBasicInfo` → `isLogin` → `findLoginData` → `rateLimiter(5/60min)` → `verifyVerifaction` → verify chain

**Body:**
```json
{
  "password": "NewSecret@456",
  "deviceId": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "deviceSize": 1080,
  "clientTimestamp": "2024-01-01T00:00:00.000Z"
}
```

**Success 200:** `{ "message": "Password changed successfully" }` — clears `verify_ctx` cookie.

**Errors:**
| Status | Cause |
|--------|-------|
| 401 | Same as old password / weak password / verify session expired |

---

### POST `/auth/forgot-password/` 🌐

**Middleware:** `rateLimiter(10/5min)`

**Body:** `{ "email": "ayush@example.com" }`

**Success 200:** Always returns success (prevents email enumeration).
```json
{ "success": true, "message": "we've sent password reset link successfully" }
```

---

### GET `/auth/reset-password/:token/` 🌐

**Middleware:** `rateLimiter(10/60min)`

Validates reset token from email link.

**Success 200:** `{ "next": "set_new_password" }`

**Errors:**
| Status | Cause |
|--------|-------|
| 400 | Token wrong length |
| 401 | Token expired or invalid |

---

### POST `/auth/reset-password/:token/` 🌐

**Middleware:** `rateLimiter(5/60min)`

**Body:** `{ "password": "NewSecret@456" }`

**Success 200:** `{ "message": "Your password has been reset successfully. Please sign in again." }`

**Errors:**
| Status | Cause |
|--------|-------|
| 401 | GET step not done first / unusual device detected / same as old password |

---

### GET `/auth/account/security-events/` 🆓

**Middleware:** `isLogin` → `findLoginData` → `rateLimiter(40/5min)`

**Query:** `?page=1&limit=20&types[]=login&types[]=stepup`

**Success 200:**
```json
{
  "meta": { "page": 1, "limit": 20, "totalEvents": 45, "totalPages": 3 },
  "events": [
    {
      "eventId": "...",
      "eventType": "login",
      "action": "login_failed",
      "success": false,
      "risk": "high",
      "loginMethod": "password",
      "mfaUsed": "none",
      "location": { "country": "IN", "city": "Mumbai" },
      "device": "Chrome on Windows",
      "createdAt": "..."
    }
  ]
}
```

---

### GET `/auth/account/active-risks/` 🆓

**Middleware:** `isLogin` → `findLoginData` → `rateLimiter(40/5min)`

**Query:** `?window=24h` (options: `1h`, `6h`, `24h`, `7d`)

**Success 200:**
```json
{
  "risk": "high",
  "reasons": ["multiple_failed_logins", "new_device"],
  "actionRequired": true,
  "recommendedActions": ["enable_2fa", "review_sessions"]
}
```

---

### POST `/auth/mfa/start/` 🆓

**Middleware:** `isLogin` → `findLoginData` → `rateLimiter(5/60min)`

Starts identity verification before MFA management. Sets `verify_ctx` cookie.

---

### POST `/auth/mfa/verify/` 🆓

**Middleware:** `isLogin` → `findLoginData` → `rateLimiter(5/60min)` → `verifyVerifaction` → verify chain

Completes identity verification. Sets `rpat` (restricted access token) for MFA manage routes.

---

### GET `/auth/mfa/manage/` 🆓

**Middleware:** `validateBasicInfo` → `isLogin` → `findLoginData` → `rateLimiter(60/10min)` → `verifedMfaUser`

**Success 200:**
```json
{
  "mfa": {
    "twoStepEnabled": true,
    "secondSteps": {
      "passkeys": { "enabled": true, "count": 2 },
      "authenticator": { "enabled": true },
      "googlePrompt": { "enabled": false, "devices": 0 },
      "email": { "enabled": true, "emails": ["a***@gmail.com"] },
      "backupCodes": { "enabled": true, "remaining": 8 }
    },
    "lastUpdated": "..."
  }
}
```

---

### POST `/auth/mfa/manage/` 🆓

Enables 2FA on account.

**Success 200:** `{ "message": "TwoFA enabled successfully" }`

---

### GET/POST/PUT/DELETE `/auth/mfa/manage/backupcode/` 🆓

| Method | Action |
|--------|--------|
| GET | List active backup codes |
| POST | Add backup codes |
| PUT | Renew (regenerate) backup codes |
| DELETE | Delete backup codes |

---

### GET/POST/PATCH/DELETE `/auth/mfa/manage/totp/` 🆓

| Method | Action |
|--------|--------|
| GET | Get TOTP status |
| POST | Add TOTP authenticator |
| PATCH | Renew TOTP secret |
| DELETE | Remove TOTP |

---

### GET/POST/DELETE `/auth/mfa/manage/email/` 🆓

| Method | Action |
|--------|--------|
| GET | List MFA emails |
| POST | Add new MFA email |
| DELETE | Remove MFA email |

### POST `/auth/mfa/manage/email/verify/` 🆓
### POST `/auth/mfa/manage/email/resend/` 🆓

---

### POST `/auth/manage/securitycode/` 🆓

**Middleware:** `validateBasicInfo` → `isLogin` → `findLoginData` → `rateLimiter(60/10min)` → `verifedMfaUser`

Creates a security code for login fallback.

---

### GET/POST/PATCH/DELETE `/auth/manage/passkey/` 🆓

| Method | Action |
|--------|--------|
| GET | List all passkeys |
| POST | Add new passkey (WebAuthn — 2 step: get challenge → submit response) |
| PATCH | Rename passkey (body: `{ id, name }`) |
| DELETE | Remove passkey (body: `{ id }`) |

**POST flow:**
1. First call → `202` with WebAuthn `options` challenge
2. Sign challenge on device
3. Second call with signed response → `201` passkey added

---

### GET/DELETE `/auth/manage/trusted-devices/` 🆓

| Method | Action |
|--------|--------|
| GET | List all trusted devices |
| DELETE | Revoke a trusted device |

---

### GET/POST `/auth/account/approve-login/:id` 🆓

Used for session approval login method (approve login from another device).

| Method | Action |
|--------|--------|
| GET | Get approval request info |
| POST | Approve or deny the login |


---

# PROFILE

> Base: `/profile`
> Base middleware: `rateLimiter(120/5min)` on all routes
> All routes except `/setup` and `/public/*` require: `isLogin` → `findLoginData` → `isProfileExists`

---

### POST `/profile/setup` 🆓

**Middleware:** `isLogin` → `findLoginData`

**Flow (2 steps):**

**Step 1 — Get upload URL (no `key` in body yet):**
```json
{
  "displayName": "Ayush Dev",
  "bio": "Full stack developer",
  "role": "developer",
  "techStack": ["Node.js", "React"],
  "lookingFor": "collaboration",
  "experienceYears": 3,
  "phone": { "countryCode": "+91", "mobile": "9999999999" },
  "fileName": "photo.jpg",
  "fileType": "image/jpeg"
}
```

**Step 1 Response 200:**
```json
{
  "code": "PHOTO_UPLOAD_PRESIGNED",
  "data": { "uploadUrl": "https://s3...", "key": "temp/userId/xxx-photo.jpg", "fileUrl": "https://..." }
}
```

**Step 2 — Confirm profile (include `key` from step 1):**
```json
{
  "displayName": "Ayush Dev",
  "bio": "Full stack developer",
  "role": "developer",
  "techStack": ["Node.js", "React"],
  "lookingFor": "collaboration",
  "experienceYears": 3,
  "phone": { "countryCode": "+91", "mobile": "9999999999" },
  "key": "temp/userId/xxx-photo.jpg"
}
```

**Step 2 Response 201:**
```json
{
  "data": {
    "username": "ayush_dev",
    "displayName": "Ayush Dev",
    "bio": "Full stack developer",
    "role": "developer",
    "tech_stack": ["Node.js", "React"],
    "looking_for": "collaboration",
    "experience_years": 3,
    "location": { "city": "Mumbai", "country": "IN" },
    "visibility": "public",
    "primaryPhoto": "https://...",
    "profileScore": 40,
    "createdAt": "..."
  }
}
```

**Errors:**
| Status | Code | Cause |
|--------|------|-------|
| 400 | — | Validation failed |
| 409 | `UPLOAD_NOT_FOUND` | Key not uploaded to S3 yet — upload first then confirm |
| 409 | — | Profile already exists |

---

### GET `/profile/me` 🆓

**Success 200:**
```json
{
  "data": {
    "id": "...",
    "username": "ayush_dev",
    "displayName": "Ayush Dev",
    "bio": "...",
    "role": "developer",
    "tech_stack": ["Node.js"],
    "looking_for": "collaboration",
    "experience_years": 3,
    "location": { "city": "Mumbai", "country": "IN" },
    "photos": [{ "id": "...", "url": "...", "isPrimary": false }, { "id": "none", "url": "...", "isPrimary": true }],
    "phone": { "countryCode": "+91", "mobile": "9999999999" },
    "visibility": "public",
    "profileScore": 40,
    "incognitoEnabled": false,
    "badges": [],
    "subscription": { "tier": "free", "isActive": false },
    "stats": { "likes": 0, "views": 0 },
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

---

### PATCH `/profile/me` 🆓

**Allowed fields:** `displayName`, `bio`, `tech_stack`, `looking_for`, `experience_years`, `visibility`, `location`, `phone`

**Body (any subset):**
```json
{
  "displayName": "New Name",
  "bio": "Updated bio",
  "tech_stack": ["Go", "Rust"],
  "location": { "city": "Delhi", "country": "IN" }
}
```

**Success 200:**
```json
{
  "message": "Profile updated successfully",
  "data": { "username": "...", "displayName": "New Name", "...": "updated fields" },
  "updatedFields": ["displayName", "bio"],
  "version": 2
}
```

**Errors:**
| Status | Cause |
|--------|-------|
| 400 | No valid fields / validation failed |

---

### DELETE `/profile/me` 🆓

**Middleware:** `rateLimiter(3/60min)`

Schedules account for deletion (30-day grace period).

**Success 200:**
```json
{
  "message": "Account scheduled for deletion",
  "data": { "gracePeriodDays": 30, "restoreUntil": "2024-02-01T00:00:00.000Z" }
}
```

**Errors:**
| Status | Code | Cause |
|--------|------|-------|
| 409 | `ALREADY_SCHEDULED` | Already scheduled for deletion |

---

### POST `/profile/restore` 🆓

**Middleware:** `rateLimiter(3/60min)`

Cancels scheduled deletion.

**Success 200:**
```json
{ "message": "Account restored successfully", "data": { "status": "active", "restoredAt": "..." } }
```

**Errors:**
| Status | Code | Cause |
|--------|------|-------|
| 400 | `NOT_IN_DELETE_STATE` | Account not scheduled for deletion |

---

### GET `/profile/stats` 🆓

**Success 200:**
```json
{
  "data": {
    "photos": [{ "id": "none", "url": "...", "isPrimary": true }],
    "likes": 12,
    "views": 45,
    "matches": 3,
    "profileScore": 40
  }
}
```

---

### PATCH `/profile/visibility` 🆓

Toggles visibility between `public` and `hidden`.

**Success 200:**
```json
{ "message": "Profile visibility updated", "data": { "visibility": "hidden" } }
```

---

### PATCH `/profile/incognito` 🥇 GOLD

**Middleware:** `checkPremiumStatus` → `isPremiumUser({ gold: true })`

Toggles incognito mode (Gold only). When enabled, profile views are not recorded and profile is hidden from public view.

**Success 200:**
```json
{ "message": "Incognito mode enabled", "data": { "incognito": true } }
```

**Errors:**
| Status | Cause |
|--------|-------|
| 403 | Not a Gold member |

---

### GET `/profile/photo` 🆓

**Middleware:** `checkPremiumStatus`

**Success 200:**
```json
{
  "data": {
    "total": 2,
    "photos": [
      { "id": "abc123", "url": "https://...", "isPrimary": false, "createdAt": "..." },
      { "id": "none", "url": "https://...", "isPrimary": true, "createdAt": "..." }
    ]
  }
}
```

---

### POST `/profile/photo` 🆓

**Middleware:** `checkPremiumStatus` → `rateLimiter(20/5min)`

Photo limit: Free = 4, Silver/Gold = 8

**Flow (2 steps):**

**Step 1 — Get upload URL:**
```json
{ "fileName": "photo.jpg", "fileType": "image/jpeg" }
```

**Step 1 Response 200:**
```json
{
  "code": "PHOTO_UPLOAD_PRESIGNED",
  "data": { "uploadUrl": "https://s3...", "key": "users/userId/xxx-photo.jpg", "fileUrl": "https://..." }
}
```

**Step 2 — Confirm upload:**
```json
{ "key": "users/userId/xxx-photo.jpg" }
```

**Step 2 Response 200:**
```json
{
  "message": "Photo uploaded successfully",
  "data": {
    "photo": { "id": "...", "url": "https://...", "contentType": "image/jpeg", "size": 204800 },
    "photosCount": 3,
    "maxPhotosAllowed": 4
  }
}
```

**Errors:**
| Status | Code | Cause |
|--------|------|-------|
| 409 | `PHOTO_LIMIT_REACHED` | Max photos reached for current plan |
| 409 | `UPLOAD_NOT_FOUND` | Key not on S3 yet |
| 400 | — | Invalid file type or name |

---

### PATCH `/profile/photo` 🆓

**Middleware:** `checkPremiumStatus` → `rateLimiter(10/5min)`

Replace primary photo. Same 2-step flow as upload.

**Step 1:** Send `fileName` + `fileType` → get `uploadUrl` + `key`
**Step 2:** Send `key` → primary photo updated

**Success 200:**
```json
{
  "code": "PHOTO_PRIMARY_UPDATED",
  "message": "Primary photo updated successfully",
  "data": { "photo": { "id": "none", "url": "https://...", "isPrimary": true, "createdAt": "..." } }
}
```

**Errors:**
| Status | Code | Cause |
|--------|------|-------|
| 409 | `UPLOAD_NOT_FOUND` | Key not on S3 yet |

---

### DELETE `/profile/photo/:photoId` 🆓

**Middleware:** `rateLimiter(20/5min)`

**Params:** `:photoId` — 24-char MongoDB ObjectId

**Success 200:**
```json
{
  "message": "Photo deleted successfully",
  "data": { "photoId": "...", "deleted": true },
  "meta": { "remainingPhotos": 2, "maxAllowed": 4, "tier": "free" }
}
```

**Errors:**
| Status | Code | Cause |
|--------|------|-------|
| 400 | `INVALID_OBJECT_ID` | photoId not 24 chars |
| 404 | `PHOTO_NOT_FOUND` | Photo not in profile |

---

### GET `/profile/views` 🥇 GOLD

**Middleware:** `checkPremiumStatus`

See who viewed your profile (Gold only).

**Query:** `?limit=10&cursor=<ISO date>`

**Success 200:**
```json
{
  "total": 45,
  "views": [
    {
      "username": "dev_user",
      "displayName": "Dev User",
      "role": "developer",
      "tech_stack": ["React"],
      "photos": [{ "id": "none", "url": "...", "isPrimary": true }],
      "location": { "city": "Delhi", "country": "IN" },
      "badges": [],
      "lastViewedAt": "...",
      "viewCount": 3
    }
  ],
  "pagination": { "limit": 10, "hasMore": true, "nextCursor": "..." }
}
```

**Errors:**
| Status | Cause |
|--------|-------|
| 403 | Not a Gold member |

---

### GET `/profile/likes` 🥈 SILVER / 🥇 GOLD

**Middleware:** `checkPremiumStatus` → `rateLimiter(20/5min)`

Silver: see up to 5 unblurred + rest blurred. Gold: see all unblurred with pagination.

**Query:** `?limit=10&cursor=<ISO date>` (cursor only works for Gold)

**Success 200:**
```json
{
  "swipes": [
    {
      "username": "dev_user",
      "displayName": "Dev User",
      "role": "developer",
      "photos": [{ "url": "...", "isPrimary": true }],
      "blurred": false,
      "seenAt": "..."
    },
    {
      "username": "hidden",
      "displayName": "Someone rigth swipe you",
      "photos": [{ "url": "blurred_url", "isPrimary": true }],
      "blurred": true
    }
  ],
  "meta": {
    "visible": 5,
    "hidden": 3,
    "upgradeHint": "Unlock Gold to see all rigth swipes",
    "upgradeTier": "gold"
  }
}
```

**Errors:**
| Status | Cause |
|--------|-------|
| 403 | Not Silver or Gold |

---

### GET `/profile/public/:username` 🌐

**Middleware:** `rateLimiter(100/5min)` → `optionalLogin` → `optionalProfile` → `isProfileBlocked`

Public profile view. No login required but more info shown when logged in.

**Success 200:**
```json
{
  "data": {
    "username": "ayush_dev",
    "displayName": "Ayush Dev",
    "bio": "...",
    "role": "developer",
    "tech_stack": ["Node.js"],
    "looking_for": "collaboration",
    "experience_years": 3,
    "photos": [{ "id": "none", "url": "...", "isPrimary": true }],
    "location": { "city": "Mumbai", "country": "IN" },
    "badges": [],
    "stats": { "likes": 12, "views": 45 }
  }
}
```

**Errors:**
| Status | Cause |
|--------|-------|
| 404 | Profile not found / hidden / blocked / incognito enabled |

---

### POST `/profile/public/:username/like` 🆓

**Middleware:** `isLogin` → `findLoginData` → `isProfileExists` → `isProfileBlocked` → `rateLimiter(50/2min)`

Like a public profile.

**Success 200:** `{ "message": "Profile liked successfully" }`

**Errors:**
| Status | Cause |
|--------|-------|
| 404 | Profile not found or blocked |

---

### DELETE `/profile/public/:username/like` 🆓

**Middleware:** `isLogin` → `findLoginData` → `isProfileExists` → `isProfileBlocked` → `rateLimiter(50/2min)`

Unlike a public profile.

**Success 200:** `{ "message": "Profile unliked successfully" }`

---

### GET `/profile/block` 🆓

List all blocked users.

**Query:** `?limit=10&cursor=<ISO date>`

**Success 200:**
```json
{
  "total": 3,
  "blocked": [
    {
      "username": "bad_user",
      "displayName": "Bad User",
      "role": "developer",
      "photos": [{ "id": "none", "url": "...", "isPrimary": true }],
      "tech_stack": ["PHP"],
      "location": { "city": "...", "country": "IN" },
      "blockedAt": "..."
    }
  ],
  "pagination": { "limit": 10, "hasMore": false, "nextCursor": null }
}
```

---

### POST `/profile/block/:username` 🆓

**Middleware:** `rateLimiter(5/5min)`

**Success 200:** `{ "message": "User blocked successfully" }`

**Errors:**
| Status | Cause |
|--------|-------|
| 400 | Cannot block yourself |
| 404 | Profile not found |
| 409 | Already blocked |

---

### DELETE `/profile/block/:username` 🆓

**Middleware:** `rateLimiter(5/5min)`

**Success 200:** `{ "message": "User unblocked successfully" }`

**Errors:**
| Status | Cause |
|--------|-------|
| 404 | Profile not found |
| 409 | User is not blocked |

---

### POST `/profile/report/:username` 🆓

**Middleware:** `isProfileBlocked` → `rateLimiter(3/5min)`

**Body:**
```json
{ "reason": "spam", "description": "This user is spamming" }
```

**Success 200:** `{ "message": "Profile reported successfully" }`

---

### GET `/profile/report/` 🆓

List profiles you have reported.

**Success 200:** `{ "reports": [...] }`

---

### GET `/profile/ringtone/incoming/` 🆓

Get current incoming ringtone.

**Success 200:** `{ "data": { "url": "...", "isDefault": true } }`

---

### PATCH `/profile/ringtone/incoming/` 🥈 SILVER / 🥇 GOLD

**Middleware:** `checkPremiumStatus` → `isPremiumUser()` → `rateLimiter(20/5min)`

Update incoming ringtone (Silver or Gold).

---

### DELETE `/profile/ringtone/incoming/` 🥈 SILVER / 🥇 GOLD

**Middleware:** `checkPremiumStatus` → `isPremiumUser()` → `rateLimiter(20/5min)`

Reset incoming ringtone to default.

---

### GET `/profile/ringtone/ringback/` 🆓

Get current ringback tone.

---

### PATCH `/profile/ringtone/ringback/` 🥇 GOLD

**Middleware:** `checkPremiumStatus` → `isPremiumUser({ gold: true })` → `rateLimiter(10/5min)`

Update ringback tone (Gold only).

---

### DELETE `/profile/ringtone/ringback/` 🥇 GOLD

**Middleware:** `checkPremiumStatus` → `isPremiumUser({ gold: true })` → `rateLimiter(10/5min)`

Reset ringback tone to default.

---

# DISCOVER

> Base: `/discover`
> Base middleware (all routes): `isLogin` → `findLoginData` → `isProfileExists` → `rateLimiter(50/2min)` → `checkPremiumStatus`

---

### GET `/discover/` 🆓

Get a new batch of profiles to swipe.

**Free limit:** 20 profiles/day
**Silver limit:** 80 profiles/day
**Gold:** Unlimited + geo-based matching

**Query (Gold only):** `?maxDistance=50000&cursor=<ISO date>&limit=10`

**Success 200:**
```json
{
  "profiles": [
    {
      "username": "dev_user",
      "displayName": "Dev User",
      "role": "developer",
      "tech_stack": ["React", "Node.js"],
      "location": { "city": "Mumbai", "country": "IN" },
      "photos": [{ "id": "none", "url": "...", "isPrimary": true }],
      "score": 0.87,
      "badges": []
    }
  ],
  "pagination": { "hasMore": true, "nextCursor": "..." },
  "meta": { "tier": "free", "remainingToday": 15, "unlimited": false }
}
```

**Errors:**
| Status | Code | Cause |
|--------|------|-------|
| 409 | `DISCOVER_BATCH_ACTIVE` | Active batch exists — call `GET /discover/old` first |
| 429 | `PROFILE_LIMIT_REACHED` | Daily limit hit — upgrade to see more |

---

### GET `/discover/old` 🆓

Get current active batch (already fetched profiles not yet swiped).

**Success 200:**
```json
{
  "message": "Old discover profiles fetched successfully.",
  "profiles": [{ "username": "...", "...": "..." }]
}
```

**Errors:**
| Status | Code | Cause |
|--------|------|-------|
| 403 | `DISCOVER_BATCH_FORBIDDEN` | IP mismatch — session from different device |
| 404 | `DISCOVER_BATCH_NOT_FOUND` | No active batch — call `GET /discover/` first |

---

### POST `/discover/pass/:username` 🆓

**Middleware:** `isProfileBlocked` → `swipeProfile`

Left swipe (pass) a profile.

**Success 200:**
```json
{
  "message": "Profile passed",
  "data": { "username": "dev_user", "action": "pass", "passed": true },
  "meta": { "tier": "free", "unlimited": false }
}
```

---

### POST `/discover/like/:username` 🆓

**Middleware:** `isProfileBlocked` → `swipeProfile`

Right swipe (like) a profile.

**Free limit:** 15 right swipes/day
**Silver limit:** 50 right swipes/day
**Gold:** Unlimited

**Success 200 (no match):**
```json
{
  "message": "Profile Liked",
  "data": { "username": "dev_user", "action": "like", "liked": true, "match": false },
  "meta": { "tier": "free", "unlimited": false }
}
```

**Success 201 (match!):**
```json
{
  "message": "It's a match",
  "data": { "username": "dev_user", "action": "like", "liked": true, "match": true, "matchId": "..." },
  "meta": { "tier": "free", "unlimited": false, "next": "open_chat", "route": "/chat/matchId" }
}
```

**Errors:**
| Status | Code | Cause |
|--------|------|-------|
| 429 | `RIGTH_SWIPE_LIMIT_REACHED` | Daily right swipe limit hit |

---

### GET `/discover/likes` 🥈 SILVER / 🥇 GOLD

See who right-swiped your profile.

Silver: first 5 unblurred, rest blurred.
Gold: all unblurred with cursor pagination.

**Query (Gold):** `?limit=10&cursor=<ISO date>`

**Success 200:** (same shape as `GET /profile/likes`)

**Errors:**
| Status | Cause |
|--------|-------|
| 403 | Not Silver or Gold |

---

### POST `/discover/rewind/` 🥇 GOLD

**Middleware:** `rateLimiter(15/5min)`

Undo last left swipe. Gold only.

**Daily limit:** Standard Gold = 10 rewinds/day, Lifetime Gold = higher limit

**Success 200:**
```json
{
  "message": "Rewind successful",
  "data": {
    "action": "rewind",
    "restoredProfile": {
      "username": "dev_user",
      "displayName": "Dev User",
      "role": "developer",
      "photos": [{ "id": "none", "url": "...", "isPrimary": true }],
      "tech_stack": ["React"],
      "location": { "city": "Mumbai", "country": "IN" },
      "badges": []
    }
  },
  "meta": { "tier": "gold", "rewindRemainingToday": 9 }
}
```

**Errors:**
| Status | Code | Cause |
|--------|------|-------|
| 403 | `PREMIUM_REQUIRED` | Not Gold |
| 409 | `NOTHING_TO_REWIND` | No previous left swipe to undo |
| 429 | `REWIND_LIMIT_REACHED` | Daily rewind limit hit |

---

### POST `/discover/boost/` 🥈 SILVER / 🥇 GOLD

**Middleware:** `rateLimiter(5/10min)` → `checkPacksStatus`

Boost your profile visibility temporarily.

**Success 200:** `{ "message": "Profile boosted successfully" }`

**Errors:**
| Status | Cause |
|--------|-------|
| 403 | No active boost pack |


---

# MATCH

> Base: `/match`
> Base middleware (all routes): `isLogin` → `findLoginData` → `isProfileExists` → `rateLimiter(80/2min)` → `checkPremiumStatus`

---

### GET `/match/` 🆓

Get all your matches with pagination.

**Query:** `?limit=10&cursor=<ISO date>`

**Success 200:**
```json
{
  "matches": [
    {
      "matchId": "...",
      "status": "active",
      "user": {
        "username": "dev_user",
        "displayName": "Dev User",
        "role": "developer",
        "photos": [{ "id": "none", "url": "...", "isPrimary": true }],
        "badges": []
      },
      "createdAt": "...",
      "lastMessageAt": "..."
    }
  ],
  "pagination": { "hasMore": true, "nextCursor": "..." }
}
```

**Errors:**
| Status | Cause |
|--------|-------|
| 400 | Invalid cursor format |

---

### GET `/match/:matchId` 🆓

**Middleware:** `rateLimiter(40/2min)`

Get a specific match detail.

**Params:** `:matchId` — 24-char MongoDB ObjectId

**Success 200:**
```json
{
  "data": {
    "matchId": "...",
    "status": "active",
    "createdAt": "...",
    "lastMessageAt": "...",
    "user": {
      "username": "dev_user",
      "displayName": "Dev User",
      "bio": "...",
      "role": "developer",
      "tech_stack": ["React"],
      "photos": [{ "id": "none", "url": "...", "isPrimary": true }],
      "location": { "city": "Mumbai", "country": "IN" },
      "badges": []
    }
  }
}
```

**Errors:**
| Status | Code | Cause |
|--------|------|-------|
| 400 | `INVALID_MATCH_ID` | matchId not 24 chars |
| 403 | `MATCH_FORBIDDEN` | You are not part of this match |
| 404 | `MATCH_NOT_FOUND` | Match does not exist |
| 410 | `MATCH_CLOSED` | Match unmatched or profile hidden/blocked |

**410 Unmatched response (Gold sees who unmatched):**
```json
{
  "code": "MATCH_CLOSED",
  "data": {
    "status": "unmatched",
    "unmatchedAt": "...",
    "isSelf": false,
    "unmatchedBy": {
      "displayName": "Dev User",
      "username": "dev_user",
      "picture": { "url": "..." }
    }
  }
}
```
> Non-gold users see `"unmatchedBy": "hidden"`

---

### DELETE `/match/:matchId` 🆓

**Middleware:** `rateLimiter(10/10min)`

Unmatch / revoke a match.

**Success 200:** `{ "message": "Match revoked successfully" }`

**Errors:**
| Status | Code | Cause |
|--------|------|-------|
| 400 | `INVALID_MATCH_ID` | matchId not 24 chars |
| 404 | `MATCH_NOT_FOUND` | Match does not exist |

---

### GET `/match/restore/` 🆓

Get all deactivated (unmatched) matches.

**Success 200:**
```json
{
  "matches": [
    {
      "matchId": "...",
      "status": "unmatched",
      "user": { "username": "...", "displayName": "..." },
      "unmatchedAt": "..."
    }
  ]
}
```

---

### POST `/match/restore/:matchId` 🥈 SILVER / 🥇 GOLD

**Middleware:** `rateLimiter(10/10min)` → `isPremiumUser()`

Restore a previously unmatched match. Requires Silver or Gold.

**Success 200:** `{ "message": "Match restored successfully" }`

**Errors:**
| Status | Code | Cause |
|--------|------|-------|
| 403 | `PREMIUM_REQUIRED` | Not Silver or Gold |
| 404 | `MATCH_NOT_FOUND` | Match does not exist |

---

# CHAT

> Base: `/chat`
> Base middleware (all routes): `isLogin` → `findLoginData` → `isProfileExists` → `rateLimiter(50/2min)`

---

### GET `/chat/` 🆓

Get all chats (inbox).

**Query:** `?limit=10&cursor=<ISO date>`

**Success 200:**
```json
{
  "message": "All chats fetched successfull",
  "chats": [
    {
      "chatId": "...",
      "matchId": "...",
      "opponent": {
        "username": "dev_user",
        "displayName": "Dev User",
        "primaryPhoto": { "url": "..." }
      },
      "lastMessage": {
        "text": "Hey!",
        "type": "text",
        "sender": "...",
        "messageId": "...",
        "sentAt": "..."
      },
      "lastMessageAt": "...",
      "unreadCount": 2,
      "isPinned": false,
      "isMuted": false,
      "isArchived": false
    }
  ],
  "pagination": { "hasMore": true, "nextCursor": "..." }
}
```

---

### GET `/chat/:chatId` 🆓

Get specific chat info.

**Params:** `:chatId` — 24-char MongoDB ObjectId

**Success 200:**
```json
{
  "message": "Chat fetched successfully",
  "data": {
    "chatId": "...",
    "matchId": "...",
    "opponent": {
      "userId": "...",
      "username": "dev_user",
      "displayName": "Dev User",
      "primaryPhoto": { "url": "..." },
      "lastSeen": "..."
    },
    "settings": {
      "isPinned": false,
      "isMuted": false,
      "isArchived": false,
      "unreadCount": 0
    },
    "lastMessage": { "text": "Hey!", "type": "text", "sentAt": "..." },
    "lastMessageAt": "...",
    "permissions": {
      "canSendMessage": true,
      "canCall": true,
      "canVideoCall": true
    }
  }
}
```

**Errors:**
| Status | Code | Cause |
|--------|------|-------|
| 400 | `INVALID_CHAT_ID` | chatId not valid ObjectId |
| 403 | `CHAT_FORBIDDEN` | You are not part of this chat |
| 404 | `CHAT_NOT_FOUND` | Chat does not exist |
| 409 | `CHAT_CLOSED` | Chat is no longer active |

---

### GET `/chat/:chatId/messages` 🆓

**Middleware:** `validateChatAccess`

Get messages for a chat with cursor pagination.

**Query:** `?limit=10&cursor=<ISO date>`

**Success 200:**
```json
{
  "message": "All messages fetched successfull",
  "data": {
    "chatId": "...",
    "messages": [
      {
        "messageId": "...",
        "type": "text",
        "text": "Hey!",
        "senderId": "...",
        "createdAt": "...",
        "status": "read"
      }
    ]
  },
  "pagination": { "hasMore": true, "nextCursor": "..." }
}
```

> Automatically marks unread messages as read on fetch.

---

### GET `/chat/message/:messageId` 🆓

Get a single message by ID.

**Success 200:**
```json
{
  "message": "Message fetched successfully",
  "data": {
    "chatId": "...",
    "messageId": "...",
    "type": "text",
    "text": "Hey!",
    "senderId": "...",
    "createdAt": "..."
  }
}
```

**Errors:**
| Status | Code | Cause |
|--------|------|-------|
| 404 | `MESSAGE_NOT_FOUND` | Message deleted or not accessible |
| 404 | `CHAT_NOT_FOUND` | Chat no longer exists |

---

### DELETE `/chat/:chatId/clear` 🆓

**Middleware:** `validateChatAccess`

Clear all messages for yourself only (soft delete — sets `deletedAt` timestamp).

**Success 200:**
```json
{
  "message": "Chat cleared successfully",
  "data": { "chatId": "...", "clearedAt": "..." }
}
```

---

### DELETE `/chat/:chatId` 🥇 GOLD

**Middleware:** `validateChatAccess`

Hard delete all messages for everyone. Gold or Admin only.

**Success 200:**
```json
{
  "message": "All messages deleted successfully",
  "data": { "chatId": "...", "deletedCount": 42 }
}
```

**Errors:**
| Status | Code | Cause |
|--------|------|-------|
| 403 | `FORBIDDEN` | Not Gold or Admin |

---

### PATCH `/chat/:chatId/pin` 🆓

**Middleware:** `validateChatAccess`

Toggle pin on a chat.

**Success 200:** `{ "message": "Chat pin toggled" }`

---

### PATCH `/chat/:chatId/mute` 🆓

**Middleware:** `validateChatAccess`

Toggle mute on a chat.

**Success 200:** `{ "message": "Chat mute toggled" }`

---

### PATCH `/chat/:chatId/archive` 🆓

**Middleware:** `validateChatAccess`

Toggle archive on a chat.

**Success 200:** `{ "message": "Chat archive toggled" }`

---

### POST `/chat/upload` 🆓

Upload media for chat (image, audio, video).

**Body:** multipart/form-data with file

**Success 200:**
```json
{
  "data": { "url": "https://s3...", "key": "...", "type": "image/jpeg", "size": 204800 }
}
```

---

### POST `/chat/sync` 🆓

Sync chat metadata (unread counts, last seen, etc).

**Success 200:** `{ "message": "Sync successful" }`

---

# CALL

> Base: `/call`
> Base middleware (all routes): `isLogin` → `findLoginData` → `isProfileExists` → `rateLimiter(50/2min)`

---

### GET `/call/` 🆓

Get call history with pagination.

**Query:** `?limit=20&cursor=<ISO date>`

**Success 200:**
```json
{
  "message": "Call history fetched successfully",
  "calls": [
    {
      "callId": "...",
      "chatId": "...",
      "type": "audio",
      "status": "ended",
      "isActive": false,
      "direction": "outgoing",
      "with": {
        "userId": "...",
        "name": "Dev User",
        "photo": "https://..."
      },
      "timestamps": { "startedAt": "...", "endedAt": "..." },
      "duration": 120,
      "endReason": "normal"
    }
  ],
  "pagination": { "hasMore": true, "nextCursor": "..." }
}
```

---

### GET `/call/:callId` 🆓

Get specific call detail.

**Success 200:**
```json
{
  "call": {
    "callId": "...",
    "chatId": "...",
    "type": "video",
    "status": "ongoing",
    "isActive": true,
    "direction": "incoming",
    "with": { "userId": "...", "name": "Dev User", "photo": "..." },
    "participants": {
      "caller": { "userId": "...", "name": "...", "photo": "..." },
      "receiver": { "userId": "...", "name": "...", "photo": "..." }
    },
    "media": { "audio": true, "video": true },
    "timestamps": { "createdAt": "...", "startedAt": "...", "endedAt": null },
    "duration": null,
    "endReason": null,
    "connection": {
      "canAccept": false,
      "canReject": false,
      "canReconnect": true,
      "resumeWebRTC": true,
      "gracePeriod": 15
    }
  }
}
```

**Errors:**
| Status | Code | Cause |
|--------|------|-------|
| 404 | `CALL_NOT_FOUND` | Call does not exist or not your call |

---

### DELETE `/call/` 🆓

Delete all call logs (only ended/missed calls, not active ones).

**Success 200:**
```json
{ "success": true, "message": "Call history cleared successfully" }
```

---

### DELETE `/call/:callId` 🆓

Delete a specific call log.

**Success 200:**
```json
{
  "success": true,
  "message": "Call deleted successfully",
  "data": { "callId": "..." }
}
```

**Errors:**
| Status | Code | Cause |
|--------|------|-------|
| 404 | `CALL_NOT_FOUND` | Call not found or still active |


---

# SUBSCRIPTION

> Base: `/subscription`
> Base middleware (all routes except webhooks): `isLogin` → `findLoginData` → `isProfileExists` → `checkPremiumStatus` → `rateLimiter(50/2min)`
> Webhook routes (`/webhook/*`) skip auth — verified via Cashfree signature

---

### GET `/subscription/plans` 🆓

Get all available subscription plans with current user context.

**Success 200:**
```json
{
  "currentPlan": {
    "id": "free",
    "label": "Free",
    "isPaid": false,
    "isTrial": false,
    "startedAt": null,
    "expiresAt": null,
    "isLifetime": false
  },
  "popularPlan": "silver",
  "plans": [
    {
      "id": "free",
      "label": "Free",
      "price": 0,
      "currency": "INR",
      "duration": null,
      "isDefault": true,
      "popular": false,
      "isCurrent": true,
      "canUpgrade": false,
      "canDowngrade": false,
      "requiresPayment": false,
      "features": {}
    },
    {
      "id": "silver",
      "label": "Silver",
      "price": 199,
      "currency": "INR",
      "duration": 30,
      "isDefault": false,
      "popular": true,
      "isCurrent": false,
      "canUpgrade": true,
      "canDowngrade": false,
      "requiresPayment": true,
      "features": {}
    },
    {
      "id": "gold",
      "label": "Gold",
      "price": 399,
      "currency": "INR",
      "duration": 30,
      "isDefault": false,
      "popular": false,
      "isCurrent": false,
      "canUpgrade": true,
      "canDowngrade": false,
      "requiresPayment": true,
      "features": {}
    },
    {
      "id": "gold_trial",
      "label": "Gold (30 Days Trial)",
      "price": 0,
      "currency": "INR",
      "duration": 30,
      "isTrial": true,
      "requiresPayment": false,
      "features": {}
    }
  ]
}
```

> `gold_trial` only appears if user has never used a trial before and has no active Gold.

---

### GET `/subscription/subscription-status` 🆓

Get current subscription status of logged-in user.

**Success 200:**
```json
{
  "tier": "silver",
  "isActive": true,
  "isLifetime": false,
  "isTrial": false,
  "since": "2024-01-01T00:00:00.000Z",
  "expiresAt": "2024-02-01T00:00:00.000Z"
}
```

---

### GET `/subscription/history` 🆓

**Middleware:** `validateBasicInfo`

Get subscription purchase history.

**Success 200:**
```json
{
  "history": [
    {
      "id": "...",
      "action": "PURCHASE",
      "fromPlan": "free",
      "toPlan": "silver",
      "isTrial": false,
      "createdAt": "..."
    }
  ]
}
```

---

### POST `/subscription/checkout` 🆓

**Middleware:** `validateBasicInfo` → `rateLimiter(10/5min)` → `validatePlan` → `initlizeGateway` → `validateCoupon` → `finalizeAmount` → `createOrder` → `sendPayment`

Initiate a subscription purchase via Cashfree.

**Body:**
```json
{
  "planId": "silver",
  "coupon": "SAVE50",
  "method": "upi",
  "deviceId": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "deviceSize": 1080,
  "clientTimestamp": "2024-01-01T00:00:00.000Z"
}
```

`planId` options: `silver` | `gold`

**Success 200:**
```json
{
  "orderId": "...",
  "gateway": "cashfree",
  "method": "upi",
  "payment": {
    "orderId": "cf_order_xxx",
    "paymentSessionId": "session_xxx"
  },
  "expiresIn": 600
}
```

**Errors:**
| Status | Code | Cause |
|--------|------|-------|
| 400 | `PLAN_NOT_FOUND` | Invalid planId |
| 400 | `COUPON_INVALID` | Coupon expired / not applicable |
| 400 | `COUPON_LIMIT_REACHED` | Coupon usage limit exceeded |

---

### POST `/subscription/activate-trial` 🆓

**Middleware:** `validateBasicInfo` → `rateLimiter(5/60min)` → `activateTrial` → `initlizeGateway` → `createAutopay` → `sendPayment`

Activate Gold 30-day free trial (sets up autopay mandate).

**Body:**
```json
{
  "deviceId": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "deviceSize": 1080,
  "clientTimestamp": "2024-01-01T00:00:00.000Z"
}
```

**Success 200:**
```json
{
  "orderId": "...",
  "gateway": "cashfree",
  "payment": {
    "orderId": "sub_xxx",
    "subscriptionSessionId": "sub_session_xxx"
  },
  "expiresIn": 600
}
```

**Errors:**
| Status | Cause |
|--------|-------|
| 409 | Trial already used or active Gold exists |

---

### POST `/subscription/refund` 🆓

**Middleware:** `rateLimiter(5/60min)`

Request refund for current subscription.

**Success 200:** `{ "message": "Refund initiated successfully" }`

**Errors:**
| Status | Cause |
|--------|-------|
| 400 | No active subscription to refund |
| 409 | Refund already requested |

---

### POST `/subscription/refund-autopay` 🆓

**Middleware:** `rateLimiter(5/60min)`

Request refund for autopay subscription.

**Success 200:** `{ "message": "Autopay refund initiated successfully" }`

---

### POST `/subscription/pause-autopay` 🆓

**Middleware:** `rateLimiter(10/60min)`

Pause active autopay mandate.

**Success 200:** `{ "message": "Autopay paused successfully" }`

**Errors:**
| Status | Cause |
|--------|-------|
| 404 | No active autopay found |

---

### POST `/subscription/resume-autopay` 🆓

**Middleware:** `rateLimiter(10/60min)`

Resume paused autopay mandate.

**Success 200:** `{ "message": "Autopay resumed successfully" }`

---

### POST `/subscription/cancel-autopay` 🆓

**Middleware:** `rateLimiter(3/60min)`

Cancel autopay mandate permanently.

**Success 200:** `{ "message": "Autopay cancelled successfully" }`

**Errors:**
| Status | Cause |
|--------|-------|
| 404 | No active autopay found |

---

### POST `/subscription/webhook/payment` 🌐

**Middleware:** `validateSigntaure` → `validateBody` → `validateOrder` → `handlePaymentCoupon` → `handlePaymentSuccess`

Cashfree payment webhook. Verifies signature, activates subscription on success.

> Do NOT call this manually. Cashfree calls this automatically after payment.

---

### POST `/subscription/webhook/autopay` 🌐

**Middleware:** `validateSigntaure` → `validateSubscriptionBody` → `handleAutoPayWebhook` → `handleAutoPaySuccess`

Cashfree autopay webhook. Handles subscription renewals.

---

### POST `/subscription/webhook/refund/payment` 🌐

**Middleware:** `validateSigntaure` → `validateRefundBody` → `handleRefundWebhook`

Cashfree refund webhook for one-time payments.

---

### POST `/subscription/webhook/refund/autopay` 🌐

**Middleware:** `validateSigntaure` → `validateRefundBody` → `handleRefundAutoPayWebhook`

Cashfree refund webhook for autopay subscriptions.

---

# PAYMENT

> Base: `/payment`
> Base middleware (all routes): `isLogin` → `findLoginData` → `isProfileExists` → `rateLimiter(100/2min)`

---

### GET `/payment/coupons` 🆓

Get all available active coupons for the current user.

**Success 200:**
```json
{
  "coupons": [
    {
      "code": "SAVE50",
      "discount": { "type": "flat", "value": 50 },
      "applicablePlans": ["silver", "gold"],
      "expiresAt": "2024-12-31T00:00:00.000Z"
    }
  ]
}
```

---

### POST `/payment/coupon` 🆓

Validate a coupon code before checkout.

**Body:**
```json
{ "code": "SAVE50", "planId": "silver" }
```

**Success 200:**
```json
{
  "valid": true,
  "code": "SAVE50",
  "discount": { "type": "flat", "value": 50 },
  "finalAmount": 149
}
```

**Errors:**
| Status | Cause |
|--------|-------|
| 400 | Coupon not found / expired / not applicable to plan |
| 409 | Coupon usage limit reached |

---

# PUSH NOTIFICATIONS

> Base: `/push`

---

### POST `/push/subscribe` 🆓

**Middleware:** `isLogin` → `findLoginData` → `isProfileExists` → `rateLimiter(20/5min)`

Subscribe device for web push notifications.

**Body:**
```json
{
  "endpoint": "https://fcm.googleapis.com/...",
  "keys": {
    "p256dh": "...",
    "auth": "..."
  }
}
```

**Success 200:** `{ "message": "Push subscription saved successfully" }`

**Errors:**
| Status | Cause |
|--------|-------|
| 400 | Invalid push subscription object |

---

### DELETE `/push/unsubscribe` 🆓

**Middleware:** `isLogin` → `findLoginData` → `isProfileExists` → `rateLimiter(20/5min)`

Unsubscribe device from web push notifications.

**Body:**
```json
{ "endpoint": "https://fcm.googleapis.com/..." }
```

**Success 200:** `{ "message": "Push subscription removed successfully" }`

**Errors:**
| Status | Cause |
|--------|-------|
| 404 | Subscription not found |

---

# SYSTEM

> Base: `/system`

---

### GET `/system/health/` 🌐

**Middleware:** `rateLimiter(60/1min)`

Check health of all backend services.

**Success 200:**
```json
{
  "success": true,
  "status": "ok",
  "services": {
    "db": "ok",
    "redis": "ok",
    "mail": "ok",
    "push": "ok"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Degraded 503:**
```json
{
  "success": true,
  "status": "degraded",
  "services": {
    "db": "ok",
    "redis": "down",
    "mail": "ok",
    "push": "disabled"
  },
  "timestamp": "..."
}
```

> Returns `503` if any service is down/disabled.

---

# QUICK REFERENCE — ALL ROUTES

| Method | Route | Auth | Tier |
|--------|-------|------|------|
| POST | `/auth/signup/` | ❌ | 🌐 |
| GET | `/auth/verify/` | ❌ | 🌐 |
| POST | `/auth/login/identify/` | ❌ | 🌐 |
| POST | `/auth/login/confirm/` | ❌ | 🌐 |
| POST | `/auth/verify-2fa/start/` | ❌ | 🌐 |
| POST | `/auth/verify-2fa/resend/` | ❌ | 🌐 |
| POST | `/auth/verify-2fa/confirm/` | ❌ | 🌐 |
| POST | `/auth/refresh/` | ❌ | 🌐 |
| POST | `/auth/forgot-password/` | ❌ | 🌐 |
| GET | `/auth/reset-password/:token/` | ❌ | 🌐 |
| POST | `/auth/reset-password/:token/` | ❌ | 🌐 |
| POST | `/auth/logout/` | ✅ | 🆓 |
| POST | `/auth/logout-all/` | ✅ | 🆓 |
| GET | `/auth/session/` | ✅ | 🆓 |
| POST | `/auth/session/revoke/:id/` | ✅ | 🆓 |
| GET | `/auth/me` | ✅ | 🆓 |
| POST | `/auth/change-password/start/` | ✅ | 🆓 |
| POST | `/auth/change-password/confirm/` | ✅ | 🆓 |
| GET | `/auth/account/security-events/` | ✅ | 🆓 |
| GET | `/auth/account/active-risks/` | ✅ | 🆓 |
| GET/POST | `/auth/account/approve-login/:id` | ✅ | 🆓 |
| POST | `/auth/mfa/start/` | ✅ | 🆓 |
| POST | `/auth/mfa/verify/` | ✅ | 🆓 |
| GET/POST | `/auth/mfa/manage/` | ✅ MFA | 🆓 |
| GET/POST/PUT/DELETE | `/auth/mfa/manage/backupcode/` | ✅ MFA | 🆓 |
| GET/POST/PATCH/DELETE | `/auth/mfa/manage/totp/` | ✅ MFA | 🆓 |
| GET/POST/DELETE | `/auth/mfa/manage/email/` | ✅ MFA | 🆓 |
| POST | `/auth/mfa/manage/email/verify/` | ✅ MFA | 🆓 |
| POST | `/auth/mfa/manage/email/resend/` | ✅ MFA | 🆓 |
| POST | `/auth/manage/securitycode/` | ✅ MFA | 🆓 |
| GET/POST/PATCH/DELETE | `/auth/manage/passkey/` | ✅ MFA | 🆓 |
| GET/DELETE | `/auth/manage/trusted-devices/` | ✅ MFA | 🆓 |
| POST | `/profile/setup` | ✅ | 🆓 |
| GET/PATCH/DELETE | `/profile/me` | ✅ | 🆓 |
| POST | `/profile/restore` | ✅ | 🆓 |
| GET | `/profile/stats` | ✅ | 🆓 |
| PATCH | `/profile/visibility` | ✅ | 🆓 |
| PATCH | `/profile/incognito` | ✅ | 🥇 |
| GET/POST/PATCH | `/profile/photo` | ✅ | 🆓 |
| DELETE | `/profile/photo/:photoId` | ✅ | 🆓 |
| GET | `/profile/views` | ✅ | 🥇 |
| GET | `/profile/likes` | ✅ | 🥈/🥇 |
| GET | `/profile/public/:username` | ❌ | 🌐 |
| POST | `/profile/public/:username/like` | ✅ | 🆓 |
| DELETE | `/profile/public/:username/like` | ✅ | 🆓 |
| GET | `/profile/block` | ✅ | 🆓 |
| POST/DELETE | `/profile/block/:username` | ✅ | 🆓 |
| POST | `/profile/report/:username` | ✅ | 🆓 |
| GET | `/profile/report/` | ✅ | 🆓 |
| GET/PATCH/DELETE | `/profile/ringtone/incoming/` | ✅ | 🆓/🥈 |
| GET/PATCH/DELETE | `/profile/ringtone/ringback/` | ✅ | 🆓/🥇 |
| GET | `/discover/` | ✅ | 🆓 |
| GET | `/discover/old` | ✅ | 🆓 |
| POST | `/discover/pass/:username` | ✅ | 🆓 |
| POST | `/discover/like/:username` | ✅ | 🆓 |
| GET | `/discover/likes` | ✅ | 🥈/🥇 |
| POST | `/discover/rewind/` | ✅ | 🥇 |
| POST | `/discover/boost/` | ✅ | 🥈/🥇 |
| GET | `/match/` | ✅ | 🆓 |
| GET | `/match/restore/` | ✅ | 🆓 |
| GET/DELETE | `/match/:matchId` | ✅ | 🆓 |
| POST | `/match/restore/:matchId` | ✅ | 🥈/🥇 |
| GET | `/chat/` | ✅ | 🆓 |
| GET | `/chat/message/:messageId` | ✅ | 🆓 |
| POST | `/chat/sync` | ✅ | 🆓 |
| POST | `/chat/upload` | ✅ | 🆓 |
| GET | `/chat/:chatId` | ✅ | 🆓 |
| DELETE | `/chat/:chatId` | ✅ | 🥇 |
| DELETE | `/chat/:chatId/clear` | ✅ | 🆓 |
| GET | `/chat/:chatId/messages` | ✅ | 🆓 |
| PATCH | `/chat/:chatId/pin` | ✅ | 🆓 |
| PATCH | `/chat/:chatId/mute` | ✅ | 🆓 |
| PATCH | `/chat/:chatId/archive` | ✅ | 🆓 |
| GET/DELETE | `/call/` | ✅ | 🆓 |
| GET/DELETE | `/call/:callId` | ✅ | 🆓 |
| GET | `/subscription/plans` | ✅ | 🆓 |
| GET | `/subscription/subscription-status` | ✅ | 🆓 |
| GET | `/subscription/history` | ✅ | 🆓 |
| POST | `/subscription/checkout` | ✅ | 🆓 |
| POST | `/subscription/activate-trial` | ✅ | 🆓 |
| POST | `/subscription/refund` | ✅ | 🆓 |
| POST | `/subscription/refund-autopay` | ✅ | 🆓 |
| POST | `/subscription/pause-autopay` | ✅ | 🆓 |
| POST | `/subscription/resume-autopay` | ✅ | 🆓 |
| POST | `/subscription/cancel-autopay` | ✅ | 🆓 |
| POST | `/subscription/webhook/payment` | ❌ | 🌐 |
| POST | `/subscription/webhook/autopay` | ❌ | 🌐 |
| POST | `/subscription/webhook/refund/payment` | ❌ | 🌐 |
| POST | `/subscription/webhook/refund/autopay` | ❌ | 🌐 |
| GET | `/payment/coupons` | ✅ | 🆓 |
| POST | `/payment/coupon` | ✅ | 🆓 |
| POST | `/push/subscribe` | ✅ | 🆓 |
| DELETE | `/push/unsubscribe` | ✅ | 🆓 |
| GET | `/system/health/` | ❌ | 🌐 |
