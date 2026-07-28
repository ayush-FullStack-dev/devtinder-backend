import cookie from "cookie";
import signature from "cookie-signature";
import { getSession } from "../../../../services/session.service.js";

export const approvalJoin = async (socket) => {
  try {
    socket.on("disconnect", () => {
      delete socket.data.approvalId;
    });

    const rawCookie = socket.handshake.headers.cookie;

    if (!rawCookie) {
      return socket.disconnect(true);
    }

    const cookies = cookie.parse(rawCookie);

    const approvalToken = cookies.approvalId;

    if (!approvalToken?.startsWith("s:")) {
      return socket.disconnect(true);
    }

    const approvalId = signature.unsign(
      approvalToken.slice(2),
      process.env.COOKIE_SECRET,
    );

    if (!approvalId) {
      return socket.disconnect(true);
    }

    const approval = await getSession(`session:approval:${approvalId}`);

    if (
      !approval ||
      approval.used ||
      approval.status !== "pending" ||
      new Date(approval.expiredAt) < new Date()
    ) {
      return socket.disconnect(true);
    }

    socket.join(`approval:${approvalId}`);
    socket.data.approvalId = approvalId;
  } catch (err) {
    console.error(err);
    socket.disconnect(true);
  }
};
