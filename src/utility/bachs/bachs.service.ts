import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const LIVE_BASE_URL = 'https://api.bachs.io';
const SANDBOX_BASE_URL = 'https://sandbox-api.bachs.io';

interface CreateCheckoutInput {
  applicationId: string;
  email: string;
  name: string;
}

// Only the fields we read from Bachs' checkout session (docs.bachs.io, `POST /v1/checkout-sessions`).
export interface BachsCheckoutSession {
  checkout_id: string;
  checkout_url: string;
  status: string;
  payment_status?: string;
  reference?: string;
}

@Injectable()
export class BachsService {
  private readonly logger = new Logger(BachsService.name);

  constructor(private readonly config: ConfigService) {}

  async createCheckout({
    applicationId,
    email,
    name,
  }: CreateCheckoutInput): Promise<BachsCheckoutSession> {
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    // Bachs rejects localhost redirect URLs, so local dev points these at a public URL instead.
    const successUrl =
      this.config.get<string>('BACHS_SUCCESS_URL') ||
      new URL('/success', frontendUrl).toString();
    const cancelUrl =
      this.config.get<string>('BACHS_CANCEL_URL') ||
      new URL('/cancel', frontendUrl).toString();

    return this.request<BachsCheckoutSession>('/v1/checkout-sessions', {
      method: 'POST',
      body: JSON.stringify({
        customer: { email, name },
        ...this.priceFields(),
        success_url: successUrl,
        cancel_url: cancelUrl,
        // Lets us trace a payment back to its application from the Bachs dashboard.
        metadata: { application_id: applicationId },
      }),
    });
  }

  getCheckoutSession(checkoutId: string): Promise<BachsCheckoutSession> {
    return this.request<BachsCheckoutSession>(
      `/v1/checkout-sessions/${encodeURIComponent(checkoutId)}`,
    );
  }

  // Never trust a webhook body for this: the caller re-fetches the session with our API key first.
  isPaid(session: BachsCheckoutSession): boolean {
    return session.payment_status
      ? session.payment_status === 'succeeded'
      : session.status === 'completed';
  }

  // A fixed Bachs product wins; otherwise a raw amount + currency ("pure" checkout, no products).
  private priceFields() {
    const productId = this.config.get<string>('BACHS_PRODUCT_ID');
    if (productId) {
      return { product_cart: [{ product_id: productId, quantity: 1 }] };
    }

    const amount = this.config.get<string>('BACHS_AMOUNT');
    const currency = this.config.get<string>('BACHS_CURRENCY');
    if (!amount || !currency) {
      throw new Error(
        'Set BACHS_PRODUCT_ID, or both BACHS_AMOUNT and BACHS_CURRENCY, to price the program fee',
      );
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error('BACHS_AMOUNT must be a positive number, e.g. 2000');
    }
    // Bachs wants fixed prices as a two-decimal string and an upper-case currency code.
    return {
      pricing: { amount: value.toFixed(2), currency: currency.toUpperCase() },
    };
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const apiKey = this.config.get<string>('BACHS_API_KEY');
    if (!apiKey) throw new Error('BACHS_API_KEY is not set');

    const baseUrl =
      this.config.get<string>('BACHS_BASE_URL') ??
      (apiKey.startsWith('sk_live_') ? LIVE_BASE_URL : SANDBOX_BASE_URL);

    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
    });

    if (!response.ok) {
      const detail = await response.text();
      this.logger.error(
        `Bachs ${init.method ?? 'GET'} ${path} failed (${response.status}): ${detail}`,
      );
      throw new Error(`Bachs request failed (${response.status})`);
    }

    return (await response.json()) as T;
  }
}
