// Pure JWT helpers shared by the proxy and server code (no next/headers here).
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "tm_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type SessionPayload = { sub: string; sv: number };

let warned = false;
function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET must be set to a random string of at least 32 characters (openssl rand -base64 48).");
    }
    if (!warned) {
      warned = true;
      console.warn("[auth] AUTH_SECRET is not set — using an insecure development secret.");
    }
    return new TextEncoder().encode("dev-only-insecure-secret-do-not-use-in-production!!");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT({ sv: payload.sv })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.sv !== "number") return null;
    return { sub: payload.sub, sv: payload.sv };
  } catch {
    return null;
  }
}
