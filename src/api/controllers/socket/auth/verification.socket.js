export const verificationJoin = (socket) => {
  try {
    const email = socket.handshake.auth?.email;

    if (!email || typeof email !== "string") {
      return socket.disconnect(true);
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      return socket.disconnect(true);
    }

    const room = `verification:${normalizedEmail}`;

    socket.join(room);

    socket.data.verificationEmail = normalizedEmail;

    socket.on("disconnect", () => {
      delete socket.data.verificationEmail;
    });
  } catch (err) {
    console.error("Verification socket error:", err);
    socket.disconnect(true);
  }
};
