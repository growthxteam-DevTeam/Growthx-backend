import { Injectable } from '@nestjs/common';
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

    await this.transporter.sendMail({
      from:
        this.config.get<string>('MAIL_FROM') ??
        this.config.get<string>('SMTP_USER'),
      to,
      subject: 'We have received your Growth X application',
      text,
      html,
    });
  }
}
