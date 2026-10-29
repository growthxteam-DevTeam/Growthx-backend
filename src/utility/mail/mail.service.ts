import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

interface PaymentRequestMail {
  to: string;
  firstName: string;
  paymentUrl: string;
}

interface PaymentConfirmedMail {
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

  // Sent right after submission: the applicant pays first, the GS code follows.
  async sendPaymentRequest({ to, firstName, paymentUrl }: PaymentRequestMail) {
    const text = [
      `Hi ${firstName},`,
      '',
      'Thank you for applying to Growth X. We have received your application.',
      '',
      'Next step: complete your payment to secure your place.',
      `Pay here: ${paymentUrl}`,
      '',
      'Once your payment is confirmed, we will email you a link to set up your Growth Space account.',
      '',
      'The Growth X Team',
    ].join('\n');

    const html = `
      <p>Hi ${escapeHtml(firstName)},</p>
      <p>Thank you for applying to Growth X. We have received your application.</p>
      <p><strong>Next step:</strong> complete your payment to secure your place.</p>
      <p><a href="${escapeHtml(paymentUrl)}">Pay now</a></p>
      <p>Once your payment is confirmed, we will email you a link to set up your Growth Space account.</p>
      <p>The Growth X Team</p>
    `;

    await this.deliver({
      to,
      subject: 'Complete your Growth X payment',
      text,
      html,
    });
  }

  // Sent once Bachs confirms the payment: carries the GS code that unlocks the dashboard.
  async sendPaymentConfirmed({ to, firstName, gsCode }: PaymentConfirmedMail) {
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    const onboardingUrl = new URL('/create-password', frontendUrl);
    onboardingUrl.searchParams.set('gsCode', gsCode);
    const link = onboardingUrl.toString();

    const text = [
      `Hi ${firstName},`,
      '',
      'Your payment is confirmed. Welcome to Growth X!',
      '',
      'Next step: create your password to set up your Growth Space account.',
      `Open this link: ${link}`,
      `Your GS Code: ${gsCode}`,
      '',
      'The Growth X Team',
    ].join('\n');

    const html = `
      <p>Hi ${escapeHtml(firstName)},</p>
      <p>Your payment is confirmed. Welcome to Growth X!</p>
      <p><strong>Next step:</strong> create your password to set up your Growth Space account.</p>
      <p><a href="${escapeHtml(link)}">Create your password</a></p>
      <p>Your GS Code: <strong>${escapeHtml(gsCode)}</strong></p>
      <p>The Growth X Team</p>
    `;

    await this.deliver({
      to,
      subject: 'Payment confirmed: access your Growth X dashboard',
      text,
      html,
    });
  }

  private async deliver({
    to,
    subject,
    text,
    html,
  }: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }) {
    const from =
      this.config.get<string>('MAIL_FROM') ??
      this.config.get<string>('SMTP_USER');

    const resendApiKey = this.config.get<string>('RESEND_API_KEY');
    const provider = resendApiKey ? 'Resend' : 'SMTP';

    try {
      if (resendApiKey) {
        await this.sendViaResend(resendApiKey, {
          from,
          to,
          subject,
          text,
          html,
        });
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
  private async sendViaResend(
    apiKey: string,
    mail: {
      from?: string;
      to: string;
      subject: string;
      text: string;
      html: string;
    },
  ) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: mail.from,
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Resend request failed (${response.status}): ${await response.text()}`,
      );
    }
  }
}
