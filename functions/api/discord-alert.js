// Cloudflare Pages Function for Perez Automotive website -> Discord alerts.
// Add Discord webhook URLs as Cloudflare Pages environment variables.

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function clean(value, max = 900) {
  const text = String(value ?? "").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

const webhookEnvByType = {
  application: "DISCORD_APPLICATION_WEBHOOK",
  contact: "DISCORD_GENERAL_WEBHOOK",
  vehicleRequest: "DISCORD_VEHICLE_REQUEST_WEBHOOK",
  service: "DISCORD_SERVICE_WEBHOOK",
  purchase: "DISCORD_PURCHASE_WEBHOOK",
  sale: "DISCORD_SALES_WEBHOOK",
  treasury: "DISCORD_TREASURY_WEBHOOK",
  payout: "DISCORD_PAYOUT_WEBHOOK",
  websiteAdmin: "DISCORD_WEBSITE_ADMIN_WEBHOOK",
  inventory: "DISCORD_INVENTORY_WEBHOOK",
  customer: "DISCORD_CUSTOMER_WEBHOOK",
  system: "DISCORD_SYSTEM_WEBHOOK"
};

export async function onRequestPost(context) {
  try {
    const payload = await context.request.json();
    const type = clean(payload.type || "system", 80);
    const envName = webhookEnvByType[type] || "DISCORD_SYSTEM_WEBHOOK";
    const webhookUrl = context.env[envName] || context.env.DISCORD_SYSTEM_WEBHOOK;

    if (!webhookUrl) {
      return json({ ok: false, error: `Missing Cloudflare environment variable: ${envName}` }, 500);
    }

    const fields = Object.entries(payload.fields || {})
      .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
      .slice(0, 20)
      .map(([name, value]) => ({
        name: clean(name, 256),
        value: clean(value, 1024),
        inline: String(value).length < 70
      }));

    const discordBody = {
      username: payload.username || "Perez Automotive Alerts",
      embeds: [
        {
          title: clean(payload.title || "Perez Automotive Website Alert", 256),
          description: clean(payload.description || "A website action was submitted.", 2048),
          color: 0xD4AF37,
          fields,
          timestamp: new Date().toISOString(),
          footer: { text: "Perez Automotive Website" }
        }
      ],
      allowed_mentions: { parse: [] }
    };

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(discordBody)
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return json({ ok: false, error: `Discord webhook failed: ${res.status} ${text}` }, 502);
    }

    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: String(error.message || error) }, 500);
  }
}
