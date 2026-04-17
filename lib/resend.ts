import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendWelcomeEmail(email: string, name?: string) {
  try {
    await resend.emails.send({
      from: "Zepply <onboarding@zepply.app>",
      to: email,
      subject: "Welcome to Zepply! 🚀",
      html: `
        <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #6C3AE8; font-size: 28px; margin: 0;">Zepply</h1>
          </div>
          <h2 style="color: #1A1A2E; font-size: 22px;">Hey ${name || "there"}! 👋</h2>
          <p style="color: #4A4A6A; font-size: 16px; line-height: 1.6;">
            Welcome to Zepply — your Instagram automation is now live!
          </p>
          <p style="color: #4A4A6A; font-size: 16px; line-height: 1.6;">
            Here's what to do next:
          </p>
          <ol style="color: #4A4A6A; font-size: 16px; line-height: 1.8;">
            <li>Create your first trigger</li>
            <li>Set up a welcome message for new followers</li>
            <li>Watch leads roll in!</li>
          </ol>
          <div style="text-align: center; margin-top: 32px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" 
               style="background: #6C3AE8; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
              Go to Dashboard →
            </a>
          </div>
          <p style="color: #8888AA; font-size: 13px; text-align: center; margin-top: 40px;">
            Made for India 🇮🇳 · Zepply 2026
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send welcome email:", error);
  }
}

export async function sendLeadAlertEmail(
  email: string,
  leadUsername: string,
  triggerKeyword: string
) {
  try {
    await resend.emails.send({
      from: "Zepply <alerts@zepply.app>",
      to: email,
      subject: `🎯 New lead captured: @${leadUsername}`,
      html: `
        <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="color: #6C3AE8; font-size: 24px;">New Lead Captured! 🎯</h1>
          <p style="color: #4A4A6A; font-size: 16px; line-height: 1.6;">
            <strong>@${leadUsername}</strong> triggered your <strong>"${triggerKeyword}"</strong> keyword.
          </p>
          <p style="color: #4A4A6A; font-size: 16px;">
            Zepply already sent the auto-reply. Check your dashboard for details.
          </p>
          <div style="text-align: center; margin-top: 24px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/leads" 
               style="background: #6C3AE8; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              View Leads →
            </a>
          </div>
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send lead alert:", error);
  }
}

export async function sendMagicLinkEmail(email: string, url: string) {
  try {
    await resend.emails.send({
      from: "Zepply <login@zepply.app>",
      to: email,
      subject: "Sign in to Zepply",
      html: `
        <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; text-align: center;">
          <h1 style="color: #6C3AE8; font-size: 28px;">Zepply</h1>
          <p style="color: #4A4A6A; font-size: 16px; margin: 24px 0;">
            Click the button below to sign in to your account.
          </p>
          <a href="${url}" 
             style="display: inline-block; background: #6C3AE8; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
            Sign In to Zepply
          </a>
          <p style="color: #8888AA; font-size: 13px; margin-top: 32px;">
            This link expires in 24 hours. If you didn't request this, ignore this email.
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send magic link:", error);
  }
}
