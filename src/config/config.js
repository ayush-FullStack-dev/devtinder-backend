import dotenv from "dotenv";
import { getPath } from "../utilities/index.js";

dotenv.config({
  path: getPath.envPath,
});

export const config = {
  MONGO_URL: process.env.MONGO_URL || "mongouri://localhost:5127/test",
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || "development",
};

export default config;
