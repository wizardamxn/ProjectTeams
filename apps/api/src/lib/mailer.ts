import { config, isProd } from "../config.js";
import { logger } from "./logger.js";

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

// Transactional email through Resend's HTTP API. Without RESEND_API_KEY,
// non-production environments log the email instead of sending it.
export const sendMail = async (mail: Mail) => {
  if (!config.RESEND_API_KEY) {
    if (isProd) throw new Error("RESEND_API_KEY is not set; cannot send email");
    logger.info({ to: mail.to, subject: mail.subject }, `[mail:dev]\n${mail.text}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: config.MAIL_FROM, ...mail }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend error ${res.status}: ${body.slice(0, 200)}`);
  }
};
