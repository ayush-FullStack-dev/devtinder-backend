import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import config from "../config/config.js";

export const getPasskey = async (user) => {
  const options = await generateAuthenticationOptions({
    rpID: process.env.DOMAIN,
    allowCredentials: user.loginMethods.passkeys.keys.map((k) => ({
      id: k.credentialId,
      type: "public-key",
      transports: k.transports || [],
    })),
    timeout: 60000,
    userVerification: "required",
  });

  return options;
};

export const verifyKey = async (auth, saved, passkey) => {
  try {
    const verification = await verifyAuthenticationResponse({
      response: auth,
      expectedChallenge: saved?.challenge,
      expectedOrigin: process.env.DOMAIN_LINK,
      expectedRPID: process.env.DOMAIN,
      credential: {
        id: passkey.credentialId,
        publicKey: Buffer.from(passkey.publicKey, "base64url"),
        counter: passkey.counter,
        transports: passkey.transports,
      },
    });

    return verification;
  } catch (error) {
    return null;
  }
};
