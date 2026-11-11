// PayPal SANDBOX REST helpers. Server-only: reads PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET.
export const PAYPAL_HOST = "https://api-m.sandbox.paypal.com";

let cached: { token: string; expiresAt: number } | null = null;

export class PayPalError extends Error {
  constructor(public status: number, public body: string) {
    super(`PayPal ${status}: ${body}`);
  }
}

/** paypal-token: OAuth client credentials, cached until a minute before expiry. */
export async function getPayPalToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const id = process.env["PAYPAL_CLIENT_ID"];
  const secret = process.env["PAYPAL_CLIENT_SECRET"];
  if (!id || !secret) throw new Error("PayPal isn't set up yet. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.");
  const res = await fetch(`${PAYPAL_HOST}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new PayPalError(res.status, await res.text());
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

export async function paypal<T = any>(path: string, init: { method?: string; body?: unknown; requestId?: string } = {}): Promise<T> {
  const token = await getPayPalToken();
  const res = await fetch(`${PAYPAL_HOST}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      Prefer: "return=representation",
      ...(init.requestId ? { "PayPal-Request-Id": init.requestId } : {}),
    },
    body: init.body === undefined ? null : JSON.stringify(init.body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`PayPal request failed [${res.status}] ${path}: ${text}`);
    throw new PayPalError(res.status, text);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export function createAuthorizeOrder(opts: { amount: number; currency: string; customId: string; description: string; requestId: string }) {
  return paypal<{ id: string; status: string }>("/v2/checkout/orders", {
    method: "POST",
    requestId: opts.requestId,
    body: {
      intent: "AUTHORIZE",
      purchase_units: [
        {
          custom_id: opts.customId,
          description: opts.description.slice(0, 127),
          amount: { currency_code: opts.currency, value: opts.amount.toFixed(2) },
        },
      ],
      application_context: { shipping_preference: "NO_SHIPPING", brand_name: "Kitty", user_action: "CONTINUE" },
    },
  });
}

export async function authorizeOrder(orderId: string) {
  const res = await paypal<any>(`/v2/checkout/orders/${orderId}/authorize`, {
    method: "POST",
    requestId: `auth-${orderId}`,
    body: {},
  });
  const auth = res?.purchase_units?.[0]?.payments?.authorizations?.[0];
  return { status: res.status as string, authorizationId: auth?.id as string | undefined, expiresAt: auth?.expiration_time as string | undefined, authStatus: auth?.status as string | undefined };
}

/** Void a hold. requestId should be 'void-' + contribution id. An already-voided hold counts as done. */
export async function voidAuthorization(authorizationId: string, requestId = `void-${authorizationId}`) {
  try {
    await paypal(`/v2/payments/authorizations/${authorizationId}/void`, { method: "POST", requestId });
  } catch (e) {
    if (e instanceof PayPalError && /AUTHORIZATION_ALREADY_VOIDED|AUTHORIZATION_VOIDED|AUTHORIZATION_EXPIRED/.test(e.body)) return;
    throw e;
  }
}

const amt = (value: number, currency: string) => ({ currency_code: currency, value: value.toFixed(2) });

export function getAuthorization(id: string) {
  return paypal<{ id: string; status: string; expiration_time?: string }>(`/v2/payments/authorizations/${id}`);
}

export function reauthorize(id: string, amount: number, currency: string, requestId: string) {
  return paypal<{ id: string; status: string; expiration_time?: string }>(`/v2/payments/authorizations/${id}/reauthorize`, {
    method: "POST",
    requestId,
    body: { amount: amt(amount, currency) },
  });
}

/** final=false leaves the rest of the hold open so a re-split can top up; Kitty voids the remainder afterwards. */
export function captureAuthorization(id: string, amount: number, currency: string, requestId: string, final = true) {
  return paypal<{ id: string; status: string }>(`/v2/payments/authorizations/${id}/capture`, {
    method: "POST",
    requestId,
    body: { amount: amt(amount, currency), final_capture: final },
  });
}

export function refundCapture(captureId: string, requestId: string, amount?: { value: number; currency: string }) {
  return paypal<{ id: string; status: string }>(`/v2/payments/captures/${captureId}/refund`, {
    method: "POST",
    requestId,
    body: amount ? { amount: amt(amount.value, amount.currency) } : {},
  });
}

// Payouts v1 uses { value, currency } for amounts, unlike Orders/Payments v2 which use currency_code.
export async function createPayout(o: { batchId: string; email: string; amount: number; currency: string; note: string; itemId: string }) {
  const res = await paypal<any>("/v1/payments/payouts", {
    method: "POST",
    requestId: o.batchId,
    body: {
      sender_batch_header: { sender_batch_id: o.batchId, email_subject: "Your Kitty gift money is here", email_message: o.note.slice(0, 255) },
      items: [{ recipient_type: "EMAIL", receiver: o.email, amount: { value: o.amount.toFixed(2), currency: o.currency }, note: o.note.slice(0, 4000), sender_item_id: o.itemId }],
    },
  });
  const batchId = res?.batch_header?.payout_batch_id as string;
  let itemId: string | null = null;
  let status = (res?.batch_header?.batch_status as string) ?? "PENDING";
  try {
    const d = await paypal<any>(`/v1/payments/payouts/${batchId}`);
    itemId = d?.items?.[0]?.payout_item_id ?? null;
    status = d?.batch_header?.batch_status ?? status;
  } catch { /* details are best-effort */ }
  return { batchId, itemId, status };
}

/** Turn a PayPal failure into plain words for people. */
export function plainPayPalError(e: unknown): string {
  if (e instanceof PayPalError) {
    if (e.status === 401) return "PayPal didn't accept Kitty's keys. The organiser needs to check the PayPal setup.";
    if (e.status === 422) {
      if (e.body.includes("INSTRUMENT_DECLINED")) return "PayPal declined that payment method. Try a different card or account.";
      if (e.body.includes("ORDER_ALREADY_AUTHORIZED")) return "That hold is already in place.";
      return "PayPal couldn't place the hold. Please try again.";
    }
    return "PayPal is having a moment. Please try again in a few seconds.";
  }
  return e instanceof Error ? e.message : "Something went wrong. Please try again.";
}
