import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendOpts {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(opts: SendOpts) {
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.FROM_EMAIL || "Mailcraft <onboarding@resend.dev>",
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, id: data?.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
