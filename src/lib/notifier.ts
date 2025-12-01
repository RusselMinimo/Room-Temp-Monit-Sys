import "server-only";

import type { ActiveAlert } from "@/types/alerts";
import { Buffer } from "node:buffer";

interface EmailConfig {
  apiKey: string;
  from: string;
  to: string;
}

interface SmsConfig {
  accountSid: string;
  authToken: string;
  from: string;
  to: string;
}

function getEmailConfig(): EmailConfig | undefined {
  const apiKey = process.env.ALERT_RESEND_API_KEY;
  const from = process.env.ALERT_EMAIL_FROM;
  const to = process.env.ALERT_EMAIL_TO;
  if (!apiKey || !from || !to) return undefined;
  return { apiKey, from, to };
}

function getSmsConfig(): SmsConfig | undefined {
  const accountSid = process.env.ALERT_TWILIO_ACCOUNT_SID;
  const authToken = process.env.ALERT_TWILIO_AUTH_TOKEN;
  const from = process.env.ALERT_SMS_FROM;
  const to = process.env.ALERT_SMS_TO;
  if (!accountSid || !authToken || !from || !to) return undefined;
  return { accountSid, authToken, from, to };
}

function formatAlertCopy(alert: ActiveAlert): { subject: string; body: string } {
  const label = alert.roomLabel ?? alert.deviceId;
  const condition = alert.variant === "high" ? "HIGH" : "LOW";
  const comparison = alert.variant === "high" ? "above" : "below";
  const subject = `TempReader alert · ${label} ${condition}`;
  const body = [
    `Room: ${label}`,
    `Device: ${alert.deviceId}`,
    ...(alert.userEmail ? [`User: ${alert.userEmail}`] : []),
    `Condition: ${condition}`,
    `Reading: ${alert.temperatureC.toFixed(1)}°C (${comparison} ${alert.thresholdC.toFixed(1)}°C)`,
    `Detected: ${new Date(alert.triggeredAt).toLocaleString()}`,
  ].join("\n");
  return { subject, body };
}

async function sendEmail(alert: ActiveAlert): Promise<void> {
  const config = getEmailConfig();
  if (!config) return;

  const copy = formatAlertCopy(alert);
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.from,
      to: [config.to],
      subject: copy.subject,
      text: copy.body,
    }),
  });
}

async function sendSms(alert: ActiveAlert): Promise<void> {
  const config = getSmsConfig();
  if (!config) return;

  const copy = formatAlertCopy(alert);
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
  const body = new URLSearchParams({
    To: config.to,
    From: config.from,
    Body: copy.body,
  });

  await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
}

export async function sendAlertNotifications(alert: ActiveAlert): Promise<void> {
  const tasks: Promise<void>[] = [];
  if (getEmailConfig()) tasks.push(sendEmail(alert));
  if (getSmsConfig()) tasks.push(sendSms(alert));
  if (tasks.length === 0) return;

  const results = await Promise.allSettled(tasks);
  results.forEach((result) => {
    if (result.status === "rejected") {
      console.error("[alerts] Failed to deliver notification", result.reason);
    }
  });
}



