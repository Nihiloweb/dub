import { pretty, render } from "@react-email/render";
import nodemailer from "nodemailer";
import { CreateEmailOptions } from "resend";

const isDubCoAddress = (address?: string | null) => {
  if (!address) return false;
  // Match bare or display-name forms like "Dub.co <system@dub.co>"
  return /@([a-z0-9.-]*\.)?dub\.co\b/i.test(address);
};

// Send email using NodeMailer (Recommended for local development / self-hosted SMTP)
export const sendViaNodeMailer = async ({
  to,
  subject,
  text,
  react,
  from: fromOpt,
}: Pick<CreateEmailOptions, "subject" | "text" | "react" | "from"> & {
  to: string;
}) => {
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure =
    process.env.SMTP_SECURE === "true" || port === 465;
  const defaultFrom =
    process.env.SMTP_FROM || "noreply@example.com";
  // Prefer an explicit non-dub.co from; otherwise SMTP_FROM (never send as @dub.co via OVH)
  const from =
    fromOpt && !isDubCoAddress(fromOpt) ? fromOpt : defaultFrom;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    secure,
    requireTLS: !secure,
    tls: {
      rejectUnauthorized: false,
    },
  });

  return await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html: await pretty(await render(react)),
  });
};
