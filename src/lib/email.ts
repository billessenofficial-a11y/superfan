import { env, features } from "./env";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

/**
 * Transactional email. Uses Resend when configured; otherwise logs the
 * message to the server console so local development works with no keys.
 */
export async function sendEmail(message: EmailMessage): Promise<{ delivered: boolean; id?: string }> {
  if (!features.resend) {
    console.info(
      `\n[email:console] To: ${message.to}\nSubject: ${message.subject}\n${message.text ?? stripHtml(message.html)}\n`,
    );
    return { delivered: false };
  }
  const { Resend } = await import("resend");
  const resend = new Resend(env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
  return { delivered: true, id: data?.id };
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function magicLinkEmail(input: { url: string; artistName?: string }): Omit<EmailMessage, "to"> {
  const title = input.artistName ? `Sign in to your ${input.artistName} Fan Passport` : "Sign in to Superfan";
  return {
    subject: title,
    text: `${title}\n\nOpen this link to sign in (it expires in 15 minutes):\n${input.url}\n\nIf you did not request this, you can ignore this email.`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0a0a0a">
        <h1 style="font-size:20px;margin:0 0 16px">${title}</h1>
        <p style="font-size:15px;line-height:1.5;color:#444">Tap the button below to sign in. The link expires in 15 minutes.</p>
        <p style="margin:28px 0"><a href="${input.url}" style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">Sign in</a></p>
        <p style="font-size:12px;color:#888">If you did not request this email you can safely ignore it.</p>
      </div>`,
  };
}
