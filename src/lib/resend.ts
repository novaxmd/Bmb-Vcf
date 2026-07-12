// Minimal Resend email helper (no SDK dependency — plain fetch to the API).
// Requires RESEND_API_KEY and RESEND_FROM_EMAIL in the environment.
// RESEND_FROM_EMAIL must be a verified sender/domain in your Resend account.

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    throw new Error("Email service is not configured (RESEND_API_KEY / RESEND_FROM_EMAIL missing).");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Failed to send email (status ${res.status}): ${errBody}`);
  }
}

export async function sendInviteEmail(to: string, inviteUrl: string): Promise<void> {
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background:#0d1a0d; color:#d9ffd9;">
      <h2 style="color:#39ff14;">You've been invited to BMB VCF Admin</h2>
      <p>You've been invited to manage the BMB VCF contact directory as an admin.</p>
      <p>Click the button below to set your username and password. This link expires in 24 hours.</p>
      <p style="margin: 28px 0;">
        <a href="${inviteUrl}" style="background:#39ff14; color:#0d1a0d; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold;">
          Set Up Admin Account
        </a>
      </p>
      <p style="font-size:12px; color:#8bbf8b;">If the button doesn't work, copy and paste this link into your browser:<br/>${inviteUrl}</p>
      <p style="font-size:12px; color:#8bbf8b;">If you didn't expect this invite, you can safely ignore this email.</p>
    </div>
  `;
  await sendEmail(to, "You've been invited as a BMB VCF admin", html);
}

export async function sendResetPasswordEmail(to: string, resetUrl: string): Promise<void> {
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background:#0d1a0d; color:#d9ffd9;">
      <h2 style="color:#39ff14;">Reset your BMB VCF admin password</h2>
      <p>We received a request to reset the password for your admin account.</p>
      <p>Click the button below to choose a new password. This link expires in 1 hour.</p>
      <p style="margin: 28px 0;">
        <a href="${resetUrl}" style="background:#39ff14; color:#0d1a0d; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold;">
          Reset Password
        </a>
      </p>
      <p style="font-size:12px; color:#8bbf8b;">If the button doesn't work, copy and paste this link into your browser:<br/>${resetUrl}</p>
      <p style="font-size:12px; color:#8bbf8b;">If you didn't request this, you can safely ignore this email — your password will not change.</p>
    </div>
  `;
  await sendEmail(to, "Reset your BMB VCF admin password", html);
}
