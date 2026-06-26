## Backend Tech Stack

<p align="center">

  <!-- Core Backend -->

  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white" />
  <img src="https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white" />
  <img src="https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socketdotio&logoColor=white" />

</p>

<p align="center">

  <!-- Authentication & Security -->

  <img src="https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white" />
  <img src="https://img.shields.io/badge/WebAuthn-5A67D8?style=for-the-badge&logo=webauthn&logoColor=white" />
  <img src="https://img.shields.io/badge/Bcrypt-FF6B6B?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Helmet-111111?style=for-the-badge" />
  <img src="https://img.shields.io/badge/CORS-2C3E50?style=for-the-badge" />
  <img src="https://img.shields.io/badge/OTP-Validation-7C3AED?style=for-the-badge" />

</p>

<p align="center">

  <!-- Cloud & Storage -->

  <img src="https://img.shields.io/badge/AWS_S3-569A31?style=for-the-badge&logo=amazonaws&logoColor=white" />
  <img src="https://img.shields.io/badge/Firebase_Admin-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" />
  <img src="https://img.shields.io/badge/Web_Push-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" />

</p>

<p align="center">

  <!-- Payments -->

  <img src="https://img.shields.io/badge/Razorpay-02042B?style=for-the-badge&logo=razorpay&logoColor=white" />
  <img src="https://img.shields.io/badge/Cashfree-0066FF?style=for-the-badge" />

</p>

<p align="center">

  <!-- Utilities -->

  <img src="https://img.shields.io/badge/Axios-5A29E4?style=for-the-badge&logo=axios&logoColor=white" />
  <img src="https://img.shields.io/badge/Joi-Validation-D16BA5?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Nodemailer-0A66C2?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Cron_Jobs-4CAF50?style=for-the-badge" />
  <img src="https://img.shields.io/badge/QRCode-000000?style=for-the-badge" />
  <img src="https://img.shields.io/badge/GeoIP-00897B?style=for-the-badge" />
  <img src="https://img.shields.io/badge/User_Agent_Parser-607D8B?style=for-the-badge" />

</p>

<p align="center">

  <!-- Media & Misc -->

  <img src="https://img.shields.io/badge/FFmpeg-007808?style=for-the-badge&logo=ffmpeg&logoColor=white" />
  <img src="https://img.shields.io/badge/Dotenv-ECD53F?style=for-the-badge&logo=dotenv&logoColor=black" />
  <img src="https://img.shields.io/badge/Chalk-222222?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Figlet-FF9800?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Epochify-Custom_Package-6C63FF?style=for-the-badge" />

</p>

# DevTinder — Backend

Professional backend for DevTinder: a developer-focused matchmaking and discovery service.

This repository contains the server-side implementation (APIs, realtime sockets, background jobs, and integrations) powering DevTinder's mobile and web clients.

---

## Quick summary

- Language & runtime: Node.js (ES modules)
- Entry point: `server.js`
- Framework: Express
- Realtime: `socket.io` (chat & call namespaces)
- Database: MongoDB (Mongoose)
- Cache / coordination: Redis (ioredis)
- Push & messaging: Firebase Admin + Web Push
- File storage: AWS S3 (optional)
- Payments: Cashfree / Razorpay integrations

## What this service does

- Handles user onboarding, authentication, profile management, matching logic, and subscriptions.
- Exposes REST endpoints for client operations and `socket.io` namespaces for realtime chat and calls.
- Runs scheduled background jobs (subscription management, cleanup, notifications).
- Integrates with third-party services: S3 for files, Firebase for push, Cashfree/Razorpay for payments.

## How it works (high-level)

1. Requests hit the Express app (`src/app.js`) and are routed to feature controllers under `src/api/controllers/`.
2. Controllers delegate to services in `src/services/` which implement business logic and interact with Mongoose models in `src/models/`.
3. Authentication issues tokens and secures HTTP + socket endpoints; sockets use middleware and shared services for state and authorization.
4. Background tasks in `cron/` and `jobs/` run on schedule (via `node-cron`) to handle subscriptions, notifications, and maintenance.

## Key scripts

- `npm install` — install dependencies
- `npm run dev` — start with `nodemon server.js` (development)
- `npm start` — start with `node server.js` (production)

Quick start:

```bash
npm install
npm run dev
```

## Environment & secrets (important)

Set required variables in your environment or a `.env` file (do not commit `.env`):

- `MONGO_URL` — MongoDB connection string (production must provide a real URI)
- `PORT` — HTTP server port (defaults to `3000` if unset)
- `NODE_ENV` — `development` or `production`

Optional integration variables:

- `REDIS_URI` — Redis connection string
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` — S3 credentials

Sensitive files:

- Place Firebase service account and RSA keys in the `env/` folder for local dev or mount them via secrets in production. See `env/help.md`.

## How to use (client & developer notes)

- See `API_USAGE.md` for endpoint examples and client-handling guidance (response shape, example flows).
- Client behavior on successful responses: persist tokens, initialize socket connections, and navigate to authenticated views.
- On failures: surface `message` to users and use HTTP status codes to categorize errors (401, 400, 5xx).

## Architecture & code layout

- `server.js` — bootstraps the HTTP server, sockets, DB, and services.
- `src/app.js` — Express application and middleware.
- `src/config/` — configuration and third-party initializers (Mongo, Redis, Firebase, S3, web-push).
- `src/api/routes/` — route definitions.
- `src/api/controllers/` — controllers that handle requests.
- `src/services/` — business logic and orchestration.
- `src/models/` — Mongoose models and schema definitions.
- `src/helpers/`, `src/middlewares/`, `cron/`, `jobs/` — utilities, middleware, and scheduled tasks.

## Logging & monitoring

- The project uses `logs/printLogs.js` for colored console output during boot and runtime. For production, consider structured logging (e.g., `pino`, `winston`) and integration with a log/metrics system.

## Development tips

- Use `npm run dev` for iterative development with automatic restarts.
- For production use a process manager (PM2, systemd) or run inside Docker.
- Keep secrets out of VCS; use environment-based secret management in CI/CD or your cloud provider.

## Deployment notes

- No build step is required; ensure Node.js version supports ES modules (Node 16+ recommended).
- Ensure secrets (Mongo, Redis, S3, Firebase) are available to the runtime before starting.

## Security considerations

- Never commit the `env/` folder or key files.
- Rotate credentials regularly and enforce least-privilege on service accounts.

## Where to look in the repo

- App entry: `server.js`
- Express bootstrap: `src/app.js`
- Config: `src/config/`
- Routes: `src/api/routes/`
- Controllers: `src/api/controllers/`
- Services: `src/services/`
- Models: `src/models/`
- Socket handlers: `src/api/socket/`

## Lead maintainer

- Ayush Shrivastava — Principal author and lead maintainer. Responsible for architecture, core development, and guiding contributions. Please open issues for bugs or feature requests; contributions are welcome via pull requests.

## License

- ISC (as declared in `package.json`)

---

If you'd like, I can now:

- add a `.env.example` file
- scaffold unit tests for core services
- create a `Dockerfile` and `docker-compose.yml` for local development

Tell me which you'd prefer next.
