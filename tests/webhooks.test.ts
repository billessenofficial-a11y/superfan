import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { artistFans, fanEvents, webhookEvents } from "@/db/schema";
import { verifyMetaSignature, verifyShopifyHmac } from "@/lib/crypto";
import { instagramAdapter } from "@/lib/integrations/instagram";
import { shopifyAdapter } from "@/lib/integrations/shopify";
import { saveConnectedAccount } from "@/lib/integrations/store";
import { processWebhook } from "@/lib/webhooks/process";
import { closeTestDb, db, makeArtist, uniqueEmail } from "./helpers";
import { createHmac } from "node:crypto";

afterAll(closeTestDb);

describe("webhook normalization + processing", () => {
  it("verifies provider signatures", () => {
    const body = '{"hello":"world"}';
    const shopify = createHmac("sha256", "secret").update(body).digest("base64");
    expect(verifyShopifyHmac(body, shopify, "secret")).toBe(true);
    expect(verifyShopifyHmac(body, shopify, "wrong")).toBe(false);
    const meta = "sha256=" + createHmac("sha256", "secret").update(body).digest("hex");
    expect(verifyMetaSignature(body, meta, "secret")).toBe(true);
    expect(verifyMetaSignature(body + " ", meta, "secret")).toBe(false);
  });

  it("normalizes a Shopify order and processes it idempotently by webhook id", async () => {
    const { artist, owner } = await makeArtist();
    const shop = `shop-${artist.id.slice(0, 8)}.myshopify.com`;
    await saveConnectedAccount({ artistId: artist.id, provider: "shopify", account: { externalAccountId: shop, externalAccountName: shop }, isMock: false, connectedByUserId: owner.id }, db);
    const email = uniqueEmail();
    const payload = {
      id: 5001,
      name: "#5001",
      email,
      processed_at: "2026-09-20T10:00:00Z",
      current_total_price: "85.00",
      currency: "USD",
      customer: { id: 8841, email, first_name: "James", last_name: "Rellera", default_address: { city: "Los Angeles", province: "CA", country: "US" } },
      line_items: [{ title: "Afterlight Tour Hoodie", quantity: 1, price: "85.00" }],
    };
    const headers = { "x-shopify-topic": "orders/create", "x-shopify-shop-domain": shop };

    const events = await shopifyAdapter.normalizeWebhook!(payload, { integration: null, artistId: artist.id, headers });
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("shopify.order.created");
    expect(events[0].metadata?.amountCents).toBe(8500);
    expect(events[0].identity?.externalUserId).toBe("8841");

    const first = await processWebhook({ provider: "shopify", artistId: artist.id, externalEventId: "wh-1", topic: "orders/create", payload, headers });
    const second = await processWebhook({ provider: "shopify", artistId: artist.id, externalEventId: "wh-1", topic: "orders/create", payload, headers });
    const third = await processWebhook({ provider: "shopify", artistId: artist.id, externalEventId: "wh-2", topic: "orders/create", payload, headers });
    expect(first).toMatchObject({ status: "processed", produced: 1 });
    expect(second.status).toBe("duplicate");
    expect(third).toMatchObject({ status: "processed", produced: 0 }); // same order id → event dedupe

    const rows = await db.select().from(fanEvents).where(and(eq(fanEvents.artistId, artist.id), eq(fanEvents.type, "shopify.order.created")));
    expect(rows).toHaveLength(1);
    const [af] = await db.select().from(artistFans).where(eq(artistFans.artistId, artist.id));
    expect(af.lifetimeSpendCents).toBe(8500);
    const stored = await db.select().from(webhookEvents).where(eq(webhookEvents.artistId, artist.id));
    expect(stored.map((s) => s.status).sort()).toEqual(["processed", "processed"]);
  });

  it("normalizes Instagram comments and DMs without storing message content", async () => {
    const { artist } = await makeArtist();
    const payload = {
      object: "instagram",
      entry: [
        {
          id: "17841400000000001",
          time: 1_758_000_000,
          changes: [{ field: "comments", value: { id: "c_1", text: "THIS ALBUM 🔥", from: { id: "ig_1", username: "jamesmusic" }, media: { id: "m_1", media_product_type: "REELS" } } }],
          messaging: [{ sender: { id: "ig_2" }, recipient: { id: "17841400000000001" }, timestamp: 1_758_000_000_000, message: { mid: "mid_1", text: "private message" } }],
        },
      ],
    };
    const events = await instagramAdapter.normalizeWebhook!(payload, { integration: null, artistId: artist.id, headers: {} });
    expect(events.map((e) => e.type).sort()).toEqual(["instagram.comment.created", "instagram.dm.received"]);
    const dm = events.find((e) => e.type === "instagram.dm.received")!;
    expect(JSON.stringify(dm.metadata)).not.toContain("private message");
    const comment = events.find((e) => e.type === "instagram.comment.created")!;
    expect(comment.summary).toBe("Commented on an Instagram Reel");
  });
});
