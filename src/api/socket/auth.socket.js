import { approvalJoin } from "../controllers/socket/auth/approval.socket.js";
import { verificationJoin } from "../controllers/socket/auth/verification.socket.js";

export const registerAuthSocket = (authIO) => {
  authIO.on("connection", (socket) => {
    approvalJoin(socket);
    verificationJoin(socket);
  });
};
