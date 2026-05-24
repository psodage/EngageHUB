/**
 * Debug Google Business Profile posting without a connected EngageHUB account.
 *
 * Usage:
 *   npm run debug:google-business-post              # config + sample payloads (dry-run)
 *   npm run debug:google-business-post -- --live    # call Google API (needs token + ids)
 *
 * Live mode env (or flags):
 *   GOOGLE_ACCESS_TOKEN=ya29....
 *   GOOGLE_BUSINESS_ACCOUNT_ID=123456789
 *   GOOGLE_BUSINESS_LOCATION_ID=987654321
 *
 * Flags: --token= --account= --location= --type=STANDARD|EVENT|OFFER
 */
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { resolveProviderRedirectUri } from "../utils/redirectUri.util.js";
import { buildGoogleBusinessLocalPostRequest } from "../services/social/googleBusinessPostBody.util.js";

const MYBUSINESS_V4 = "https://mybusiness.googleapis.com/v4";
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(backendRoot, ".env");

dotenv.config({ path: envPath });

function mask(value, visible = 4) {
  if (!value) return "<missing>";
  if (value.length <= visible) return "*".repeat(value.length);
  return `${"*".repeat(Math.max(0, value.length - visible))}${value.slice(-visible)}`;
}

function parseArgs(argv) {
  const out = { live: false, type: "STANDARD", token: "", account: "", location: "" };
  for (const arg of argv) {
    if (arg === "--live") out.live = true;
    else if (arg.startsWith("--type=")) out.type = arg.slice("--type=".length).toUpperCase();
    else if (arg.startsWith("--token=")) out.token = arg.slice("--token=".length);
    else if (arg.startsWith("--account=")) out.account = arg.slice("--account=".length);
    else if (arg.startsWith("--location=")) out.location = arg.slice("--location=".length);
  }
  return out;
}

function sampleParsed(postType) {
  const base = {
    postType: postType === "UPDATE" ? "STANDARD" : postType,
    summary: "EngageHUB debug post — safe to delete.",
    mediaUrl: "",
    mediaFormat: null,
    ctaType: "",
    ctaUrl: "",
    eventTitle: "",
    offerTitle: "",
    startDateParts: null,
    endDateParts: null,
    couponCode: "",
    redeemUrl: "",
    termsConditions: "",
  };

  if (postType === "EVENT") {
    return {
      ...base,
      postType: "EVENT",
      eventTitle: "Debug open house",
      startDateParts: { year: 2026, month: 6, day: 1 },
      endDateParts: { year: 2026, month: 6, day: 30 },
      summary: "Join us for a debug event (delete after testing).",
    };
  }

  if (postType === "OFFER") {
    return {
      ...base,
      postType: "OFFER",
      offerTitle: "Debug summer offer",
      startDateParts: { year: 2026, month: 6, day: 1 },
      endDateParts: { year: 2026, month: 6, day: 30 },
      summary: "10% off when you mention EngageHUB debug.",
      couponCode: "DEBUG10",
    };
  }

  return {
    ...base,
    ctaType: "LEARN_MORE",
    ctaUrl: "https://example.com",
    mediaUrl: "https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png",
    mediaFormat: "PHOTO",
  };
}

async function checkGoogleApisEnabled(clientId, clientSecret) {
  if (!clientId || !clientSecret) {
    return { skipped: true, reason: "GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing" };
  }
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    const body = await tokenRes.json().catch(() => ({}));
    return {
      skipped: false,
      note: "Client-credentials grant usually fails for user OAuth clients; this only checks reachability.",
      status: tokenRes.status,
      error: body?.error || null,
      error_description: body?.error_description || null,
    };
  } catch (error) {
    return { skipped: false, error: error?.message || "fetch failed" };
  }
}

async function publishLive({ token, accountId, locationId, parsed }) {
  const { urlPath, body } = buildGoogleBusinessLocalPostRequest({ accountId, locationId, parsed });
  const url = `${MYBUSINESS_V4}${urlPath}`;
  console.log("\n--- Live API request ---");
  console.log("POST", url);
  console.log("Body:", JSON.stringify(body, null, 2));

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  console.log("Status:", response.status);
  console.log("Response:", JSON.stringify(data, null, 2));

  if (response.status >= 200 && response.status < 300) {
    console.log("\nSuccess. Post created — remove it in Google Business if this was a test.");
    return 0;
  }

  console.log("\nFailed. Common causes without a real business:");
  console.log("- No GBP location on the Google account tied to the token");
  console.log("- APIs not enabled or business.manage scope missing");
  console.log("- account/location IDs do not match a location you manage");
  return 1;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
  const redirectUri = resolveProviderRedirectUri("googleBusiness");
  const dryRunEnv = String(process.env.GOOGLE_BUSINESS_DRY_RUN || "").toLowerCase() === "true";

  const token = args.token || process.env.GOOGLE_ACCESS_TOKEN || "";
  const accountId = args.account || process.env.GOOGLE_BUSINESS_ACCOUNT_ID || "000000000000000000";
  const locationId = args.location || process.env.GOOGLE_BUSINESS_LOCATION_ID || "000000000000000000";

  console.log("=== Google Business Profile Post Debug ===");
  console.log(`.env: ${envPath}`);
  console.log(`GOOGLE_CLIENT_ID: ${mask(clientId, 6)}`);
  console.log(`GOOGLE_CLIENT_SECRET: ${clientSecret ? "set" : "missing"}`);
  console.log(`GOOGLE_BUSINESS_REDIRECT_URI: ${redirectUri || "<missing — set GOOGLE_BUSINESS_REDIRECT_URI or APP_BASE_URL>"}`);
  console.log(`GOOGLE_BUSINESS_DRY_RUN (server): ${dryRunEnv ? "true" : "false"}`);
  console.log(`Mode: ${args.live ? "live API" : "dry-run (payload only)"}`);
  console.log("");

  const types = args.live ? [args.type] : ["STANDARD", "EVENT", "OFFER"];
  for (const type of types) {
    const parsed = sampleParsed(type);
    const { urlPath, body } = buildGoogleBusinessLocalPostRequest({
      accountId,
      locationId,
      parsed,
    });
    console.log(`--- Sample ${type} post ---`);
    console.log("POST", `${MYBUSINESS_V4}${urlPath}`);
    console.log(JSON.stringify(body, null, 2));
    console.log("");
  }

  const apiProbe = await checkGoogleApisEnabled(clientId, clientSecret);
  console.log("OAuth client probe:", apiProbe.skipped ? apiProbe.reason : JSON.stringify(apiProbe, null, 2));
  console.log("");

  if (!args.live) {
    console.log("Next steps without your own business:");
    console.log("1) Enable My Business Account Management + Business Information APIs in Google Cloud.");
    console.log("2) Add business.manage scope on the OAuth consent screen.");
    console.log("3) Set GOOGLE_BUSINESS_DRY_RUN=true in .env to test EngageHUB UI/API without calling Google.");
    console.log("4) For a real API test, use a colleague’s verified location: connect in EngageHUB or run:");
    console.log("   npm run debug:google-business-post -- --live --token=ACCESS_TOKEN --account=ID --location=ID --type=STANDARD");
    return;
  }

  if (!token) {
    console.error("Live mode requires --token= or GOOGLE_ACCESS_TOKEN in .env");
    process.exitCode = 1;
    return;
  }

  const parsed = sampleParsed(args.type);
  process.exitCode = await publishLive({ token, accountId, locationId, parsed });
}

run().catch((error) => {
  console.error("Debug script failed:", error);
  process.exitCode = 1;
});
