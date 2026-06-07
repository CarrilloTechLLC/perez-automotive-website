// Cloudflare Pages Function for Perez Automotive D1 shared data.
// Requires a D1 binding named DB in Cloudflare Pages settings.

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

export async function onRequestGet(context) {
  try {
    if (!context.env.DB) {
      return json({ ok: false, error: "Missing D1 binding named DB." }, 500);
    }

    const row = await context.env.DB
      .prepare("SELECT value FROM portal_state WHERE key = ?")
      .bind("main")
      .first();

    return json({ ok: true, data: row ? JSON.parse(row.value) : null });
  } catch (error) {
    return json({ ok: false, error: String(error.message || error) }, 500);
  }
}

export async function onRequestPost(context) {
  try {
    if (!context.env.DB) {
      return json({ ok: false, error: "Missing D1 binding named DB." }, 500);
    }

    const data = await context.request.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return json({ ok: false, error: "Request body must be a JSON object." }, 400);
    }

    await context.env.DB
      .prepare(`
        INSERT INTO portal_state (key, value, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
      `)
      .bind("main", JSON.stringify(data))
      .run();

    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: String(error.message || error) }, 500);
  }
}
