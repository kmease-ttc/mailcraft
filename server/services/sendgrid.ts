import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

interface SendOpts {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(opts: SendOpts) {
  try {
    const [response] = await sgMail.send({
      from: process.env.FROM_EMAIL || "mailcraft@example.com",
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });

    return { success: true, id: response.headers["x-message-id"] as string };
  } catch (err: any) {
    const message = err.response?.body?.errors?.[0]?.message || err.message;
    return { success: false, error: message };
  }
}
