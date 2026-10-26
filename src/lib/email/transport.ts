import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { readEmailConfig } from "./config";

export type Mail = { to: { name: string; address: string }; subject: string; html: string; text: string };

// One transporter per server instance, rebuilt only if the settings change.
let cached: { key: string; transporter: Transporter } | undefined;

/** Sends through Brevo SMTP. Returns false (and sends nothing) when email isn't configured; throws on delivery errors. */
export async function sendEmail(mail: Mail): Promise<boolean> {
  const cfg = readEmailConfig();
  if (!cfg) return false;

  const key = `${cfg.host}:${cfg.port}:${cfg.user}:${cfg.pass}`;
  if (cached?.key !== key) {
    cached = {
      key,
      transporter: nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.port === 465,
        // Never send the SMTP key over an unencrypted connection.
        requireTLS: cfg.port !== 465,
        auth: { user: cfg.user, pass: cfg.pass },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      }),
    };
  }
  await cached.transporter.sendMail({ from: cfg.from, ...mail });
  return true;
}
