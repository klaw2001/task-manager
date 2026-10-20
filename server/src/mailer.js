import nodemailer from 'nodemailer';
import { config } from './config.js';

/** Email is switched on by giving the app Brevo SMTP credentials and a verified sender. Without them nothing is sent. */
export const emailEnabled = () => Boolean(config.smtp.user && config.smtp.pass && config.smtp.from);

let transport;
const getTransport = () =>
  (transport ??= nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure, // true for port 465; otherwise the connection is upgraded with STARTTLS
    requireTLS: !config.smtp.secure && config.smtp.requireTls,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  }));

/** Forget the cached connection settings (used when credentials change at runtime, e.g. in tests). */
export const resetTransport = () => { transport = undefined; };

export async function sendMail({ to, subject, text, html }) {
  if (!emailEnabled()) throw new Error('Email is not configured');
  await getTransport().sendMail({ from: config.smtp.from, to, subject, text, html });
}
