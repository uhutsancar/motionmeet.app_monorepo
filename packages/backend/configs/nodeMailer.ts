import { createRequire } from "node:module";
import type nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

let transporter: Transporter | null = null;

/**
 * Nothing on the boot path sends mail, so the SMTP transport is built on the
 * first send rather than at import time. `nodemailer` is CommonJS, so
 * createRequire loads it synchronously and sendEmail keeps its signature.
 */
const getTransporter = (): Transporter => {
  if (!transporter) {
    const mailer = createRequire(import.meta.url)("nodemailer") as typeof nodemailer;
    transporter = mailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 587,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
};

const sendEmail = ({ to, subject, body }: { to: string; subject: string; body: string }) =>
  getTransporter().sendMail({ from: process.env.SENDER_EMAIL, to, subject, html: body });

export default sendEmail;
