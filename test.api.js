#!/usr/bin/env node
/**
 * Temp API test — signup + login identify + login confirm
 * Run: node --input-type=module < test.api.js
 * Requires server running on port 8080
 */

import { execSync } from "child_process";
import { randomBytes } from "crypto";

const BASE = "http://localhost:8080/auth";
const JAR = "/tmp/dt_cookies.txt";

const tag = (l) => `\n${"─".repeat(55)}\n▶ ${l}\n${"─".repeat(55)}`;
const run = (args) => {
  try { return execSync(`curl -s -c ${JAR} -b ${JAR} ${args}`, { encoding: "utf8" }); }
  catch (e) { return e.stdout || e.message; }
};
const show = (label, raw) => {
  console.log(tag(label));
  try { console.dir(JSON.parse(raw), { depth: null }); } catch { console.log(raw); }
};

const rand = randomBytes(4).toString("hex");
const email = `test_${rand}@gmail.com`;
const username = `tester_${rand}`;
const password = "Test@1234!";
const deviceId = randomBytes(16).toString("hex"); // 32 hex chars
const clientTime = Date.now();
const deviceSize = 1920;

const body = (obj) => `-H "Content-Type: application/json" -d '${JSON.stringify(obj)}'`;

// ── 1. Signup ──────────────────────────────────────────────────────────────
show("POST /auth/signup", run(
  `-X POST ${BASE}/signup/ ` + body({
    name: "Test User", email, username,
    password, confirmPassword: password, gender: "male"
  })
));

// ── 2. Login Identify ──────────────────────────────────────────────────────
show("POST /auth/login/identify/", run(
  `-X POST ${BASE}/login/identify/ ` + body({
    email, deviceId, deviceSize, clientTime
  })
));

// ── 3. Login Confirm (password) ────────────────────────────────────────────
show("POST /auth/login/confirm/ (password)", run(
  `-X POST ${BASE}/login/confirm/ ` + body({
    method: "password", code: password,
    risk: "verylow", remember: true,
    deviceId, deviceSize, clientTime
  })
));

// ── 4. Refresh ─────────────────────────────────────────────────────────────
show("POST /auth/refresh/", run(
  `-X POST ${BASE}/refresh/ ` + body({ clientTime, deviceId, deviceSize })
));

// ── 5. Me ──────────────────────────────────────────────────────────────────
show("GET /auth/me", run(`-X GET ${BASE}/me`));

console.log("\n✓ Done. Cookies →", JAR);
