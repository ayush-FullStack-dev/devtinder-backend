import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import cors from "cors";

// crons import
import { startSubscriptionCrons } from "./cron/subscription.cron.js";

// routes
import systemRouter from "./api/routes/system.route.js";
import authRouter from "./api/routes/auth.route.js";
import pushRouter from "./api/routes/push.route.js";
import profileRouter from "./api/routes/profile.route.js";
import discoverRouter from "./api/routes/discover.route.js";
import matchRouter from "./api/routes/match.route.js";
import chatRouter from "./api/routes/chat.route.js";
import callRouter from "./api/routes/call.route.js";
import subscriptionRouter from "./api/routes/subscription.route.js";
import paymentRouter from "./api/routes/payment.route.js";

// global routes
import {
  getInfo,
  handleError,
  handleNotFound,
} from "./api/controllers/controller.js";

// others import
import { getPath } from "./utilities/index.js";

// configure appp
const app = express();
startSubscriptionCrons();

app.set("trust proxy", true);
app.set("json spaces", 2);

app.use(express.urlencoded({ extended: true }));
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  }),
);

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  }),
);

app.use(helmet());
app.use(express.static(getPath.publicDir));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(getInfo);

// routes

app.use("/system", systemRouter);
app.use("/auth", authRouter);
app.use("/profile", profileRouter);
app.use("/discover", discoverRouter);
app.use("/match", matchRouter);
app.use("/chat", chatRouter);
app.use("/call", callRouter);
app.use("/subscription", subscriptionRouter);
app.use("/payment", paymentRouter);
app.use("/push", pushRouter);

// error handers
app.use("/", handleNotFound);
app.use(handleError);

export default app;
