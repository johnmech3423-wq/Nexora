/**
 * Transactional email templates. Inline styles only (email clients
 * ignore external CSS). Brand-consistent with the app design.
 */

function shell(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f8;padding:32px 0;"><tr><td align="center">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e7e7ef;">
    <tr><td style="padding:28px 32px;background:linear-gradient(120deg,#6d5df6,#4f46e5);">
      <span style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.4px;">Nexora</span>
    </td></tr>
    <tr><td style="padding:28px 32px 8px 32px;">
      <h1 style="margin:0 0 12px 0;font-size:18px;color:#181826;letter-spacing:-0.2px;">${title}</h1>
      ${bodyHtml}
    </td></tr>
    <tr><td style="padding:12px 32px 28px 32px;color:#8b8ba3;font-size:12px;line-height:1.6;">
      You're receiving this because you use Nexora. If you didn't expect it, you can safely ignore this email.<br/>
      © ${new Date().getFullYear()} Nexora
    </td></tr>
  </table></td></tr></table></body></html>`;
}

function button(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0;"><tr><td style="border-radius:10px;background:#6d5df6;"><a href="${url}" style="display:inline-block;padding:12px 26px;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;border-radius:10px;">${label}</a></td></tr></table>`;
}

export function emailVerifyTemplate(name: string, link: string): { subject: string; html: string; text: string } {
  const subject = "Verify your email address";
  return {
    subject,
    html: shell(
      subject,
      `<p style="color:#3c3c50;font-size:14px;line-height:1.7;">Hi ${name},</p>
       <p style="color:#3c3c50;font-size:14px;line-height:1.7;">Welcome to Nexora! Please confirm your email address to activate your account. This link expires in 24 hours.</p>
       ${button(link, "Verify email address")}
       <p style="color:#8b8ba3;font-size:12px;">If the button doesn't work, copy this link: <span style="word-break:break-all;">${link}</span></p>`
    ),
    text: `Hi ${name},\n\nVerify your email: ${link}\n\nLink expires in 24 hours.`,
  };
}

export function passwordResetTemplate(name: string, link: string): { subject: string; html: string; text: string } {
  const subject = "Reset your Nexora password";
  return {
    subject,
    html: shell(
      subject,
      `<p style="color:#3c3c50;font-size:14px;line-height:1.7;">Hi ${name},</p>
       <p style="color:#3c3c50;font-size:14px;line-height:1.7;">A password reset was requested for your account. If this wasn't you, you can ignore this email. The link expires in 30 minutes.</p>
       ${button(link, "Reset password")}`
    ),
    text: `Hi ${name},\n\nReset your password here (valid 30 minutes): ${link}`,
  };
}

export function invitationTemplate(opts: {
  inviterName: string;
  orgName: string;
  roleLabel: string;
  link: string;
}): { subject: string; html: string; text: string } {
  const subject = `${opts.inviterName} invited you to join ${opts.orgName} on Nexora`;
  return {
    subject,
    html: shell(
      subject,
      `<p style="color:#3c3c50;font-size:14px;line-height:1.7;">Hi there,</p>
       <p style="color:#3c3c50;font-size:14px;line-height:1.7;"><strong>${opts.inviterName}</strong> invited you to join <strong>${opts.orgName}</strong> as <strong>${opts.roleLabel}</strong>. The invitation expires in 7 days.</p>
       ${button(opts.link, "Accept invitation")}`
    ),
    text: `${opts.inviterName} invited you to join ${opts.orgName} as ${opts.roleLabel}. Accept: ${opts.link}`,
  };
}

export function simpleTemplate(title: string, paragraphs: string[]): { subject: string; html: string; text: string } {
  const subject = title;
  const body = paragraphs.map((p) => `<p style="color:#3c3c50;font-size:14px;line-height:1.7;">${p}</p>`).join("");
  return { subject, html: shell(title, body), text: paragraphs.join("\n\n") };
}
