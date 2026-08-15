import express from "express";

import { systemHealth } from "../controllers/system/system.controller.js";
import { getPing } from "../controllers/system/ping.controller.js";

const router = express.Router();

router.get(
  "/health/",
  systemHealth,
);

router.get("/ping/", getPing);

export default router;
