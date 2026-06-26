import http from "http";
import app from "./src/app.js";
import { initSocket } from "./socket.js";
import { registerChatSocket } from "./src/api/socket/chat.socket.js";
import { registerCallSocket } from "./src/api/socket/call.socket.js";

import connectDB from "./src/config/mongodb.js";
import { connectRedis } from "./src/config/redis.js";
import { webPushStart } from "./src/config/webpush.js";
import chalk, {
  printASCII,
  errorLog,
  success,
  info
} from "./logs/printLogs.js";

// configure server
const server = http.createServer(app);
const port = process.env.PORT || 3000;

function startSocket() {
  const { callIO, chatIO } = initSocket(server);
  registerChatSocket(chatIO);
  registerCallSocket(callIO);
}

function startServer() {
  startSocket();
  server.listen(port, () => {
    info("STARTING SERVER ...");
    console.log(chalk.gray(`server is listening on port ${port} ...`));
    success("SERVER STARTED ✓");
  });
}

async function init() {
  info("SERVICE WAKING UP ...");
  if (process.env.NODE_ENV === "production") {
    console.clear();
    try {
      await connectDB();
      connectRedis();
      startServer();
      webPushStart();
      printASCII("PRODUCTION");
      return;
    } catch (err) {
      errorLog("BOOT FAILED ❌");
      console.error(err);
      process.exit(1);
    }
  }

  startServer();
  connectRedis();
  connectDB();
  webPushStart();
  printASCII("DEVLOPEMNT");
}

init();
