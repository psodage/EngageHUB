import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(projectRoot, ".env");

dotenv.config({ path: envPath });

function mask(value, visible = 4) {
  if (!value) return "<missing>";
  if (value.length <= visible) return "*".repeat(value.length);
  return `${"*".repeat(Math.max(0, value.length - visible))}${value.slice(-visible)}`;
}

function findRawEnvValue(content, key) {
  const line = content
    .split(/\r?\n/)
    .find((row) => row.trimStart().startsWith(`${key}=`));
  if (!line) return null;
  return line.slice(line.indexOf("=") + 1);
}

function unicodeDiagnostics(value) {
  if (typeof value !== "string") return [];
  const issues = [];
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    const isAllowed = code >= 48 && code <= 57;
    if (!isAllowed) {
      issues.push({
        index,
        char: JSON.stringify(value[index]),
        codePoint: `U+${code.toString(16).toUpperCase().padStart(4, "0")}`,
      });
    }
  }
  return issues;
}

function buildOAuthUrl({ platform, clientId, redirectUri, scopes, state = "debug-state" }) {
  if (!clientId) {
    throw new Error(`Missing META_APP_ID for ${platform} OAuth debug URL generation.`);
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
    state,
  });

  const authUrl = `https://www.facebook.com/v20.0/dialog/oauth?${params.toString()}`;
  const parsedClientId = new URL(authUrl).searchParams.get("client_id");

  return { platform, authUrl, parsedClientId };
}

async function verifyMetaAppId(appId, appSecret) {
  if (!appId || !appSecret) {
    return {
      skipped: true,
      reason: "META_APP_ID or META_APP_SECRET missing",
    };
  }

  const url = `https://graph.facebook.com/v20.0/${encodeURIComponent(appId)}?fields=id,name,app_type&access_token=${encodeURIComponent(`${appId}|${appSecret}`)}`;

  try {
    const response = await fetch(url);
    const body = await response.json();
    return {
      skipped: false,
      status: response.status,
      ok: response.ok,
      body,
    };
  } catch (error) {
    return {
      skipped: false,
      status: null,
      ok: false,
      error: error?.message || "Unknown fetch error",
    };
  }
}

async function run() {
  const metaAppId = process.env.META_APP_ID || "";
  const metaAppSecret = process.env.META_APP_SECRET || "";
  const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:4000";

  const rawEnv = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const rawMetaAppId = findRawEnvValue(rawEnv, "META_APP_ID");
  const trimmedMetaAppId = metaAppId.trim();

  const redirects = {
    facebook: `${appBaseUrl}/api/social/facebook/callback`,
    instagram: `${appBaseUrl}/api/social/instagram/callback`,
    threads: `${appBaseUrl}/api/social/threads/callback`,
  };

  const fbExtras = (process.env.FACEBOOK_LOGIN_EXTRA_SCOPES || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const oauthUrls = [
    buildOAuthUrl({
      platform: "facebook",
      clientId: metaAppId,
      redirectUri: redirects.facebook,
      scopes: ["public_profile", "email", ...fbExtras],
    }),
    buildOAuthUrl({
      platform: "instagram",
      clientId: metaAppId,
      redirectUri: redirects.instagram,
      scopes: ["instagram_business_basic", "instagram_business_content_publish", "instagram_manage_insights"],
    }),
    buildOAuthUrl({
      platform: "threads",
      clientId: metaAppId,
      redirectUri: redirects.threads,
      scopes: ["threads_basic", "threads_content_publish", "threads_manage_insights"],
    }),
  ];

  const formatIssues = unicodeDiagnostics(metaAppId);
  const hasDigitsOnly = /^\d+$/.test(trimmedMetaAppId);

  console.log("=== Meta OAuth Debug Report ===");
  console.log(`.env path: ${envPath}`);
  console.log(`META_APP_ID (masked): ${mask(metaAppId, 6)}`);
  console.log(`META_APP_ID length: ${metaAppId.length}`);
  console.log(`META_APP_ID trimmed length: ${trimmedMetaAppId.length}`);
  console.log(`META_APP_ID raw .env value: ${rawMetaAppId === null ? "<not found>" : JSON.stringify(rawMetaAppId)}`);
  console.log(`META_APP_ID digits-only after trim: ${hasDigitsOnly}`);
  console.log(`META_APP_SECRET present: ${metaAppSecret ? "yes" : "no"}`);
  console.log(`APP_BASE_URL: ${appBaseUrl}`);
  console.log("");

  if (formatIssues.length > 0) {
    console.log("Non-digit characters found in META_APP_ID:");
    formatIssues.forEach((issue) => {
      console.log(`- index ${issue.index}: char=${issue.char} code=${issue.codePoint}`);
    });
    console.log("");
  }

  console.log("OAuth URL checks (client_id extracted from built URL):");
  oauthUrls.forEach((item) => {
    console.log(`- ${item.platform}: client_id=${JSON.stringify(item.parsedClientId)} redirect_uri=${new URL(item.authUrl).searchParams.get("redirect_uri")}`);
  });
  console.log("");

  const graphVerification = await verifyMetaAppId(trimmedMetaAppId, metaAppSecret);
  console.log("Graph verification:");
  if (graphVerification.skipped) {
    console.log(`- skipped: ${graphVerification.reason}`);
  } else if (graphVerification.ok) {
    console.log(`- status: ${graphVerification.status}`);
    console.log(`- app id from Graph: ${graphVerification.body?.id || "<none>"}`);
    console.log(`- app name from Graph: ${graphVerification.body?.name || "<none>"}`);
    console.log(`- app type from Graph: ${graphVerification.body?.app_type || "<none>"}`);
  } else {
    console.log(`- status: ${graphVerification.status}`);
    if (graphVerification.body) {
      console.log(`- error body: ${JSON.stringify(graphVerification.body)}`);
    } else {
      console.log(`- error: ${graphVerification.error || "Unknown error"}`);
    }
  }

  console.log("");
  console.log("What to verify next:");
  console.log("1) META_APP_ID must be numeric only (no spaces/quotes).");
  console.log("2) App ID must match the app in Meta Developer Dashboard.");
  console.log("3) OAuth redirect URIs above must be added exactly in Meta app settings.");
  console.log("4) Ensure the app has required products/permissions for Facebook, Instagram, and Threads.");
}

run().catch((error) => {
  console.error("Debug script failed:", error);
  process.exitCode = 1;
});
