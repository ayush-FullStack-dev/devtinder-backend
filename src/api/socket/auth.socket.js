import { approvalJoin } from "../controllers/socket/auth/approval.socket.js";

export const registerAuthSocket = (authIO) => {
  authIO.on("connection", (socket) => {
    approvalJoin(socket);
  });
};
