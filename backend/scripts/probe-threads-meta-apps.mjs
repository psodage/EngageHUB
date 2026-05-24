import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

const threadsId = (process.env.THREADS_APP_ID || "").trim();
const metaId = (process.env.META_APP_ID || "").trim();
const igId = (process.env.INSTAGRAM_CLIENT_ID || "").trim();
const threadsSecret = (process.env.THREADS_APP_SECRET || "").trim();
const metaSecret = (process.env.META_APP_SECRET || "").trim();

async function probe(label, appId, secret) {
  if (!appId || !secret) return { label, skipped: true };
  const token = `${appId}|${secret}`;
  const url = `https://graph.facebook.com/v20.0/${encodeURIComponent(appId)}?fields=id,name,app_type&access_token=${encodeURIComponent(token)}`;
  try {
    const r = await fetch(url);
    const body = await r.json();
    return {
      label,
      status: r.status,
      ok: r.ok,
      id: body?.id,
      name: body?.name,
      appType: body?.app_type,
      error: body?.error?.message,
    };
  } catch (e) {
    return { label, error: e.message };
  }
}

const results = await Promise.all([
  probe("THREADS_APP_ID + THREADS_APP_SECRET", threadsId, threadsSecret),
  probe("META_APP_ID + META_APP_SECRET", metaId, metaSecret),
  probe("THREADS_APP_ID + META_APP_SECRET (crossed)", threadsId, metaSecret),
  probe("META_APP_ID + THREADS_APP_SECRET (crossed)", metaId, threadsSecret),
]);

console.log("=== Meta app ID alignment ===");
console.log(`THREADS_APP_ID: ${threadsId || "<missing>"}`);
console.log(`META_APP_ID:    ${metaId || "<missing>"}`);
console.log(`INSTAGRAM id:   ${igId || "<missing>"}`);
console.log(`THREADS === META: ${threadsId === metaId}`);
console.log(`THREADS === IG:   ${threadsId === igId}`);
console.log(`META === IG:      ${metaId === igId}`);
console.log("");
console.log("=== Credential probes (Graph) ===");
for (const row of results) {
  console.log(JSON.stringify(row));
}
