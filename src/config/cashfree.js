import { CFEnvironment, Cashfree } from "cashfree-pg";

export const cashfreeHeaders = {
  "x-api-version": "2025-01-01",
  "x-client-id": process.env.CASHFREE_APP_ID,
  "x-client-secret": process.env.CASHFREE_SECRET_KEY,
  "Content-Type": "application/json",
};

const cashfree = new Cashfree(
  CFEnvironment.SANDBOX,
  process.env.CASHFREE_APP_ID,
  process.env.CASHFREE_SECRET_KEY,
);

export default cashfree;
