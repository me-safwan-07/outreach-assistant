export interface SmtpConfig {
  smtpEmail: string;
  smtpUsername: string;
  smtpPassword: string;
  smtpHost: string;
  smtpPort: number;
}

export function getSmtpConfig(): SmtpConfig {
  return {
    smtpEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "",
    smtpUsername: process.env.SMTP_USER || "",
    smtpPassword: process.env.SMTP_PASS || "",
    smtpHost: process.env.SMTP_HOST || "",
    smtpPort: Number(process.env.SMTP_PORT) || 0,
  };
}
