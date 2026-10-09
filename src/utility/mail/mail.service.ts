import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

interface ApplicationReceivedMail {
  to: string;
  firstName: string;
  gsCode: string;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;

  constructor(private readonly config: ConfigService) {
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);

    this.transporter = createTransport({
      host: this.config.get<string>('SMTP_HOST'),
      port,
      secure: port === 465,
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASS'),
      },
    });
  }

  async sendApplicationReceived({
    to,
    firstName,
    gsCode,
  }: ApplicationReceivedMail) {
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    const onboardingUrl = new URL('/create-password', frontendUrl);
    onboardingUrl.searchParams.set('gsCode', gsCode);
    const link = onboardingUrl.toString();

    const text = [
      `Hi ${firstName},`,
      '',
      'Thank you for applying to Growth X. We have received your application.',
      'We review every application personally. If selected, you will hear from us within 5 business days.',
      '',
      'Next step: create your password to set up your Growth Space account.',
      `Open this link: ${link}`,
      `Your GS Code: ${gsCode}`,
      '',
      'The Growth X Team',
    ].join('\n');

    const html = `
      <p>Hi ${escapeHtml(firstName)},</p>
      <p>Thank you for applying to Growth X. We have received your application.</p>
      <p>We review every application personally. If selected, you will hear from us within 5 business days.</p>
      <p><strong>Next step:</strong> create your password to set up your Growth Space account.</p>
      <p><a href="${escapeHtml(link)}">Create your password</a></p>
      <p>Your GS Code: <strong>${escapeHtml(gsCode)}</strong></p>
      <p>The Growth X Team</p>
    `;

    const from =
      this.config.get<string>('MAIL_FROM') ??
      this.config.get<string>('SMTP_USER');
    const subject = 'We have received your Growth X application';

    const brevoApiKey = this.config.get<string>('BREVO_API_KEY');
    const provider = brevoApiKey ? 'Brevo' : 'SMTP';

    try {
      if (brevoApiKey) {
        await this.sendViaBrevo(brevoApiKey, { from, to, subject, text, html });
      } else {
        await this.transporter.sendMail({ from, to, subject, text, html });
      }
      this.logger.log(`Email sent to ${to} via ${provider}`);
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${to} via ${provider}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  // Render's free tier blocks outbound SMTP ports, so prod must use HTTPS.
  private async sendViaBrevo(
    apiKey: string,
    mail: {
      from?: string;
      to: string;
      subject: string;
      text: string;
      html: string;
    },
  ) {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: mail.from, name: 'Growth X' },
        to: [{ email: mail.to }],
        subject: mail.subject,
        textContent: mail.text,
        htmlContent: mail.html,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Brevo request failed (${response.status}): ${await response.text()}`,
      );
    }
  }
}
