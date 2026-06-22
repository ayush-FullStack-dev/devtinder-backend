# API Usage

This document contains API usage examples, the common response shape, and client-handling guidance.

## Common Status Codes

| Code | Meaning               |
| ---: | --------------------- |
|  200 | Success               |
|  201 | Resource Created      |
|  400 | Validation Error      |
|  401 | Unauthorized          |
|  403 | Forbidden             |
|  404 | Resource Not Found    |
|  429 | Rate Limited          |
|  500 | Internal Server Error |

## Response shape

All HTTP JSON endpoints follow a consistent shape:

```json
{
  "success": true,
  "message": "Human readable message",
  "data": {
    /* response payload */
  }
}
```

## Authentication

Most endpoints require authentication.

Include the access token in the `Authorization` header:

```
Authorization: Bearer <access-token>
```

## Example: login (curl)

```bash
curl -X POST https://api-devtinder.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@example.com","password":"secret"}'
```

## Example Successful Response

```json
{
  "success": true,
  "message": "Login successful",
  "data": { "token": "..." }
}
```

## Client handling (JavaScript)

```javascript
const res = await fetch("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
const json = await res.json();
if (json.success) {
  // affirmative — proceed
  localStorage.setItem("token", json.data.token);
  // initialize sockets, redirect to app, etc.
} else {
  // handle error
  console.error(json.message);
}
```

## Typical next steps after success

- Persist authentication tokens (if provided) for subsequent requests.
- Initialize socket connections (chat/call namespaces) if needed.
- Redirect to authenticated UI state or update client UI.

## Error handling

- When `success` is `false`, surface `message` to the user where safe.
- Use HTTP status codes to distinguish classes of errors: `401` (auth), `400` (validation), `5xx` (server).

---

Keep this file in sync with the actual controllers. If response wrappers or routes change, update this document.

---

Below are the primary API groups, common endpoints, short usage examples, and troubleshooting notes for everyday errors.

## Base path

All examples assume the API base is `/api` (e.g. `https://api-devtinder.onrender.com/api`). Adjust according to your proxy or deployment.

## Auth (important endpoints)

- Sign up: `POST /api/auth/signup/` — body: `{ name, email, password, ... }`
- Verify signup: `GET /api/auth/verify/?token=...`
- Login identify: `POST /api/auth/login/identify/` — start login flow (device/context)
- Login confirm: `POST /api/auth/login/confirm/` — complete login with password/2FA/passkey
- Refresh tokens: `POST /api/auth/refresh/` — returns new tokens
- Logout: `POST /api/auth/logout/` and `POST /api/auth/logout-all/`

Example — signup:

```bash
curl -X POST https://api-devtinder.onrender.com/api/auth/signup/ \
  -H "Content-Type: application/json" \
  -d '{"name":"Dev","email":"dev@example.com","password":"secret"}'
```

Example — refresh tokens (client sends refresh token in header or cookie according to your client implementation):

```bash
curl -X POST https://api-devtinder.onrender.com/api/auth/refresh/ \
  -H "Authorization: Bearer <refresh-token>"
```

Troubleshooting (auth):

- 401 Unauthorized: check token expiry and that client sends token in required header. For login flows, ensure the identify/confirm steps are followed.
- 400 Validation: inspect `message` for field-level errors; ensure payload matches validation middleware (see `src/middlewares/auth`).
- Rate limited: some auth routes are protected by `rateLimiter`; wait and retry with exponential backoff.

## Profile

- Setup profile: `POST /api/profile/setup`
- My profile: `GET /api/profile/me`, `PATCH /api/profile/me`
- Upload photo: `POST /api/profile/photo` (multipart/form-data)
- Public profile: `GET /api/profile/public/:username`
- Like / Unlike public profile: `POST /api/profile/public/:username/like` / `DELETE /api/profile/public/:username/like`
- Block / Unblock: `POST /api/profile/block/:username` / `DELETE /api/profile/block/:username`

Example — fetch own profile:

```bash
curl -H "Authorization: Bearer <token>" https://api-devtinder.onrender.com/api/profile/me
```

Troubleshooting (profile):

- 403 / 404: user or profile may not exist or is blocked; verify username and ensure your account has a profile (`/profile/setup`).
- Upload errors: ensure `Content-Type: multipart/form-data` and correct file param; check S3 credentials for storage failures.

## Discover & Swipes

- Discover feed: `GET /api/discover/`
- Like: `POST /api/discover/like/:username`
- Pass: `POST /api/discover/pass/:username`
- Rewind: `POST /api/discover/rewind/`

Example — like a user:

```bash
curl -X POST -H "Authorization: Bearer <token>" https://api-devtinder.onrender.com/api/discover/like/johndoe
```

Troubleshooting (discover):

- 429 / rate limit: feeds and swipe operations are rate-limited. Pause and retry later. Consider batching or delaying automated actions.

## Matches

- List matches: `GET /api/match/`
- Match detail: `GET /api/match/:matchId`
- Revoke (remove) match: `DELETE /api/match/:matchId`

Example — list matches:

```bash
curl -H "Authorization: Bearer <token>" https://api-devtinder.onrender.com/api/match/
```

## Chat

- List chats / inbox: `GET /api/chat/`
- Get chat info: `GET /api/chat/:chatId`
- Get messages: `GET /api/chat/:chatId/messages`
- Send media: `POST /api/chat/upload` (multipart)

Troubleshooting (chat):

- Permissions: chat routes require valid session/profile. Ensure socket auth and API token match the same account.
- Message missing: check that sender/recipient exist and are matched; check socket logs for realtime delivery errors.

## Calls

- List call logs: `GET /api/call/`
- Call detail: `GET /api/call/:callId`

## Payments & Coupons

- Get coupons: `GET /api/payment/coupons`
- Validate coupon: `POST /api/payment/coupon` with coupon code

## Push subscriptions

- Subscribe: `POST /api/push/subscribe` (body contains push subscription object)
- Unsubscribe: `DELETE /api/push/unsubscribe`

## Subscriptions (plans & checkout)

- Plans: `GET /api/subscription/plans`
- Checkout: `POST /api/subscription/checkout` (validate plan, compute amount, create order)
- Webhooks: `/api/subscription/webhook/*` — your payment gateway will post here; validate signature

Troubleshooting (payments & webhooks):

- Webhook signature failures: ensure gateway secret is correctly set in environment and that your server uses the same signature verification logic.
- Payment creation errors: verify payment provider keys and account setup; examine response payload for provider error codes.

## Common error and debugging checklist

1. Check server logs: `logs/printLogs.js` is used during boot; inspect console output or your process manager logs for stack traces.
2. Verify environment variables and secret files:
   - `MONGO_URL` reachable and credentials valid.
   - `REDIS_URI` reachable for Redis features.
   - `env/serviceAccountKey.json` exists locally or is mounted at `/etc/secrets/serviceAccountKey.json` in production for Firebase.
   - AWS credentials for S3 uploads.
3. DB connection errors: confirm Mongo is up and `MONGO_URL` is correct; check network/firewall between app and DB.
4. Redis errors: check `REDIS_URI` and monitor Redis for memory/connection issues.
5. Rate limits: many routes use a `rateLimiter` middleware; if you receive rate-limit responses, back off and retry later.
6. Validation errors: controller middleware uses `joi`/custom validators — read `message` in response to identify missing/invalid fields.
7. 500 / Uncaught exceptions: inspect stack trace in logs; ensure third-party services (S3, payment gateways) are reachable.
8. Webhook troubleshooting: check raw request and signature; in dev, replay webhook payloads from provider's dashboard.

## Client best practices

- Persist tokens securely (httpOnly cookie or secure storage) and refresh tokens promptly.
- Respect rate limits and add retry/backoff logic.
- Validate user input before sending to the API to reduce 400s.
- Log and surface server `message` values to users when safe; for debugging include correlation IDs or request IDs if you add them.

---

If you'd like, I can now:

- generate a machine-readable OpenAPI spec from the route files (partial automation)
- add a `.env.example` with all known env vars
- scaffold integration tests for the main endpoints

Tell me which one to do next.
