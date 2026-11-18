// Minimal transactional email via Resend's HTTP API (no SDK needed).
// Set RESEND_API_KEY and MAIL_FROM (e.g. "Project Teams <no-reply@yourdomain.com>").
// Without a key, non-production environments log the email instead of sending it.

export const sendMail = async ({ to, subject, html, text }) => {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY is not set; cannot send email");
    }
    console.log(`[mail:dev] to=${to} subject="${subject}"\n${text}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM,
      to,
      subject,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend error ${res.status}: ${body.slice(0, 200)}`);
  }
};
