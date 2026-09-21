import { appUrl, env, features } from "@/lib/env";
import { ingestEvent } from "@/lib/events/ingest";
import { EVENT_TYPES, type FanEventInput } from "@/lib/events/types";
import { accessTokenOf } from "./store";
import type {
  AuthorizationContext,
  CallbackContext,
  ConnectedAccount,
  IntegrationAdapter,
  IntegrationRow,
  ProviderAvailability,
  SyncResult,
  WebhookContext,
} from "./types";

export const SHOPIFY_SCOPES = ["read_orders", "read_customers", "read_all_orders"];
const API_VERSION = () => env.SHOPIFY_API_VERSION;

export function normalizeShopDomain(input: string): string | null {
  const s = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!s) return null;
  const domain = s.endsWith(".myshopify.com") ? s : `${s}.myshopify.com`;
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain) ? domain : null;
}

async function shopifyGraphql<T>(shop: string, token: string, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`https://${shop}/admin/api/${API_VERSION()}/graphql.json`, {
    method: "POST",
    headers: { "content-type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables }),
  });
  if (res.status === 429) throw new ShopifyRateLimited();
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
  return json.data as T;
}

export class ShopifyRateLimited extends Error {
  constructor() {
    super("Shopify rate limit reached");
    this.name = "ShopifyRateLimited";
  }
}

type OrderLike = {
  id: string | number;
  name?: string;
  created_at?: string;
  processed_at?: string;
  currency?: string;
  current_total_price?: string;
  total_price?: string;
  financial_status?: string;
  cancelled_at?: string | null;
  email?: string | null;
  customer?: { id?: string | number; email?: string | null; first_name?: string | null; last_name?: string | null; default_address?: { city?: string | null; province?: string | null; country?: string | null } | null } | null;
  shipping_address?: { city?: string | null; province?: string | null; country?: string | null } | null;
  line_items?: { title?: string; quantity?: number; product_id?: string | number; price?: string }[];
  test?: boolean;
};

function money(v: string | number | undefined | null): number {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function orderToEvent(artistId: string, order: OrderLike): FanEventInput | null {
  const email = order.email ?? order.customer?.email ?? undefined;
  const customerId = order.customer?.id != null ? String(order.customer.id) : null;
  if (!email && !customerId) return null;
  const orderId = String(order.id).replace(/^gid:\/\/shopify\/Order\//, "");
  const amountCents = money(order.current_total_price ?? order.total_price);
  const items = (order.line_items ?? []).map((li) => ({ title: li.title ?? "Item", quantity: li.quantity ?? 1, productId: li.product_id != null ? String(li.product_id) : null, priceCents: money(li.price) }));
  const first = items[0]?.title;
  const address = order.shipping_address ?? order.customer?.default_address ?? null;
  return {
    artistId,
    source: "shopify",
    type: EVENT_TYPES.shopifyOrderCreated,
    sourceEventId: `order:${orderId}`,
    occurredAt: new Date(order.processed_at ?? order.created_at ?? Date.now()),
    email: email && /\S+@\S+/.test(email) ? email.toLowerCase() : undefined,
    identity: customerId ? { provider: "shopify", externalUserId: customerId, displayName: [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(" ") || undefined, username: email ?? undefined } : undefined,
    profile: { firstName: order.customer?.first_name ?? undefined, lastName: order.customer?.last_name ?? undefined, city: address?.city ?? undefined, region: address?.province ?? undefined, country: address?.country ?? undefined },
    metadata: { orderId, orderName: order.name ?? `#${orderId}`, amountCents, currency: order.currency ?? "USD", items, financialStatus: order.financial_status ?? null },
    summary: first ? `Purchased ${first}${items.length > 1 ? ` +${items.length - 1} more` : ""}` : `Placed order ${order.name ?? ""}`.trim(),
  };
}

/**
 * Shopify — artist store. Uses the GraphQL Admin API for backfills and
 * webhook subscriptions (orders/create, refunds/create, orders/cancelled)
 * for live events. The legacy REST Admin API is not used.
 */
export const shopifyAdapter: IntegrationAdapter = {
  provider: "shopify",
  displayName: "Shopify",
  description: "Orders, customers and refunds from your merch store.",
  capabilities: ["Orders and order totals", "Customers and their emails", "Refunds and cancellations"],
  doesNotTrack: ["Browsing behaviour", "Abandoned carts", "Payment details"],

  availability(): ProviderAvailability {
    if (features.shopify) return { mode: "live", experimental: false, scope: "artist", note: "Install the Superfan app on your Shopify store." };
    return { mode: "mock", experimental: false, scope: "artist", note: "SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET are not configured. Connect a mock store to demo order ingestion." };
  },

  getAuthorizationUrl(ctx: AuthorizationContext) {
    if (!features.shopify) return null;
    const shop = normalizeShopDomain(ctx.params?.shop ?? "");
    if (!shop) return null;
    const params = new URLSearchParams({
      client_id: env.SHOPIFY_CLIENT_ID!,
      scope: SHOPIFY_SCOPES.join(","),
      redirect_uri: ctx.redirectUri,
      state: ctx.state,
    });
    return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
  },

  async handleCallback(ctx: CallbackContext): Promise<ConnectedAccount> {
    if (!features.shopify) throw new Error("Shopify is not configured");
    const shop = normalizeShopDomain(ctx.params?.shop ?? "");
    if (!shop) throw new Error("Invalid shop domain");
    const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_id: env.SHOPIFY_CLIENT_ID, client_secret: env.SHOPIFY_CLIENT_SECRET, code: ctx.code }),
    });
    const json = (await res.json()) as { access_token?: string; scope?: string; error_description?: string };
    if (!json.access_token) throw new Error(json.error_description ?? "Shopify did not return an access token");
    const info = await shopifyGraphql<{ shop: { id: string; name: string; myshopifyDomain: string } }>(shop, json.access_token, `{ shop { id name myshopifyDomain } }`);
    return {
      externalAccountId: shop,
      externalAccountName: shop,
      accessToken: json.access_token,
      scopes: json.scope?.split(",") ?? SHOPIFY_SCOPES,
      settings: { shopName: info.shop.name, shopGid: info.shop.id },
    };
  },

  async afterConnect(integration: IntegrationRow, account: ConnectedAccount) {
    if (!features.shopify || !account.accessToken) return;
    const callback = appUrl("/api/webhooks/shopify");
    const topics = ["ORDERS_CREATE", "REFUNDS_CREATE", "ORDERS_CANCELLED"];
    for (const topic of topics) {
      await shopifyGraphql(
        account.externalAccountId,
        account.accessToken,
        `mutation Subscribe($topic: WebhookSubscriptionTopic!, $url: URL!) {
          webhookSubscriptionCreate(topic: $topic, webhookSubscription: { callbackUrl: $url, format: JSON }) {
            userErrors { message }
          }
        }`,
        { topic, url: callback },
      ).catch((err) => console.warn(`[shopify] webhook ${topic} subscribe failed`, err));
    }
    void integration;
  },

  async mockConnect(): Promise<ConnectedAccount> {
    return { externalAccountId: "luma-store.myshopify.com", externalAccountName: "luma-store.myshopify.com", scopes: SHOPIFY_SCOPES, settings: { shopName: "Luma Vale Official Store", mock: true } };
  },

  async disconnect() {
    // Token is wiped by the store. Uninstalling the app in Shopify triggers app/uninstalled.
  },

  /** Backfill orders through the GraphQL Admin API (last 250 orders per page). */
  async sync(integration: IntegrationRow): Promise<SyncResult> {
    if (integration.isMock || !features.shopify) return { produced: 0, duplicates: 0, note: "Mock store: use Generate Demo Event to create orders." };
    const token = accessTokenOf(integration);
    if (!token || !integration.externalAccountId) throw new Error("Shopify is not connected");
    let cursor: string | null = null;
    let produced = 0;
    let duplicates = 0;
    for (let page = 0; page < 20; page++) {
      const data: {
        orders: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: {
            id: string; name: string; processedAt: string; cancelledAt: string | null; email: string | null; test: boolean;
            currentTotalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
            customer: { id: string; email: string | null; firstName: string | null; lastName: string | null; defaultAddress: { city: string | null; province: string | null; country: string | null } | null } | null;
            lineItems: { nodes: { title: string; quantity: number; product: { id: string } | null }[] };
          }[];
        };
      } = await shopifyGraphql(
        integration.externalAccountId,
        token,
        `query Orders($cursor: String) {
          orders(first: 100, after: $cursor, sortKey: PROCESSED_AT, reverse: true, query: "status:any") {
            pageInfo { hasNextPage endCursor }
            nodes {
              id name processedAt cancelledAt email test
              currentTotalPriceSet { shopMoney { amount currencyCode } }
              customer { id email firstName lastName defaultAddress { city province country } }
              lineItems(first: 10) { nodes { title quantity product { id } } }
            }
          }
        }`,
        { cursor },
      );
      for (const o of data.orders.nodes) {
        if (o.test || o.cancelledAt) continue;
        const ev = orderToEvent(integration.artistId, {
          id: o.id,
          name: o.name,
          processed_at: o.processedAt,
          email: o.email,
          currency: o.currentTotalPriceSet.shopMoney.currencyCode,
          current_total_price: o.currentTotalPriceSet.shopMoney.amount,
          customer: o.customer
            ? { id: o.customer.id.replace(/^gid:\/\/shopify\/Customer\//, ""), email: o.customer.email, first_name: o.customer.firstName, last_name: o.customer.lastName, default_address: o.customer.defaultAddress ?? undefined }
            : null,
          line_items: o.lineItems.nodes.map((li) => ({ title: li.title, quantity: li.quantity, product_id: li.product?.id ?? undefined })),
        });
        if (!ev) continue;
        const res = await ingestEvent(ev);
        if (res.status === "created") produced++;
        else duplicates++;
      }
      if (!data.orders.pageInfo.hasNextPage) break;
      cursor = data.orders.pageInfo.endCursor;
    }
    return { produced, duplicates };
  },

  async normalizeWebhook(payload: unknown, ctx: WebhookContext): Promise<FanEventInput[]> {
    const topic = ctx.headers["x-shopify-topic"] ?? "";
    const body = payload as Record<string, unknown>;
    if (topic === "orders/create" || topic === "orders/paid") {
      const order = body as OrderLike;
      if (order.test) return [];
      const ev = orderToEvent(ctx.artistId, order);
      return ev ? [ev] : [];
    }
    if (topic === "refunds/create") {
      const refund = body as { id: string | number; order_id: string | number; created_at?: string; transactions?: { amount?: string; kind?: string; status?: string }[]; refund_line_items?: { subtotal?: string }[] };
      const refunded = (refund.transactions ?? []).filter((t) => t.kind === "refund" && t.status === "success").reduce((s, t) => s + money(t.amount), 0) ||
        (refund.refund_line_items ?? []).reduce((s, li) => s + money(li.subtotal), 0);
      return [
        {
          artistId: ctx.artistId,
          source: "shopify",
          type: EVENT_TYPES.shopifyOrderRefunded,
          sourceEventId: `refund:${refund.id}`,
          occurredAt: new Date(refund.created_at ?? Date.now()),
          // The refund payload has no customer; the resolver looks up the original order's fan.
          metadata: { refundId: String(refund.id), originalSourceEventId: `order:${refund.order_id}`, refundedCents: refunded },
          summary: "Order refunded",
        },
      ];
    }
    if (topic === "orders/cancelled") {
      const order = body as OrderLike;
      return [
        {
          artistId: ctx.artistId,
          source: "shopify",
          type: EVENT_TYPES.shopifyOrderRefunded,
          sourceEventId: `cancel:${order.id}`,
          occurredAt: new Date(order.cancelled_at ?? Date.now()),
          email: order.email ?? order.customer?.email ?? undefined,
          metadata: { originalSourceEventId: `order:${order.id}`, refundedCents: money(order.current_total_price ?? order.total_price), cancelled: true },
          summary: `Order ${order.name ?? ""} cancelled`.trim(),
        },
      ];
    }
    return [];
  },
};

export { orderToEvent as shopifyOrderToEvent };
