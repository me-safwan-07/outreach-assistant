import { afterEach, describe, expect, it } from "vitest";
import { getSmtpConfig } from "../lib/email/smtpConfig";

const smtpEnvKeys = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM_EMAIL",
] as const;

const originalEnv = Object.fromEntries(
  smtpEnvKeys.map((key) => [key, process.env[key]])
);

afterEach(() => {
  for (const key of smtpEnvKeys) {
    const value = originalEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("getSmtpConfig", () => {
  it("reads SMTP configuration only from environment variables", () => {
    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_USER = "mesafwan07@gmail.com";
    process.env.SMTP_PASS = "app-password";
    process.env.SMTP_FROM_EMAIL = "sender@gmail.com";

    expect(getSmtpConfig()).toEqual({
      smtpEmail: "sender@gmail.com",
      smtpUsername: "mesafwan07@gmail.com",
      smtpPassword: "app-password",
      smtpHost: "smtp.gmail.com",
      smtpPort: 465,
    });
  });

  it("uses SMTP_USER as the sender when SMTP_FROM_EMAIL is unset", () => {
    process.env.SMTP_USER = "mesafwan07@gmail.com";
    delete process.env.SMTP_FROM_EMAIL;

    expect(getSmtpConfig().smtpEmail).toBe("mesafwan07@gmail.com");
  });

  it("does not supply SMTP defaults when environment values are missing", () => {
    for (const key of smtpEnvKeys) {
      delete process.env[key];
    }

    expect(getSmtpConfig()).toEqual({
      smtpEmail: "",
      smtpUsername: "",
      smtpPassword: "",
      smtpHost: "",
      smtpPort: 0,
    });
  });
});
