const DISCORD_API = "https://discord.com/api/v10";

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidDiscordHttpUrl(value) {
  if (value == null || typeof value !== "string") return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * @param {string} raw
 * @returns {{ executeUrl: string } | null}
 */
export function parseDiscordWebhookUrl(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return null;
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  if (!["discord.com", "discordapp.com", "canary.discord.com"].includes(host)) return null;
  const match = url.pathname.match(/^\/api\/(?:v\d+\/)?webhooks\/(\d+)\/([^/?#]+)$/);
  if (!match) return null;
  const executeUrl = `${url.origin}/api/webhooks/${match[1]}/${match[2]}`;
  return { executeUrl };
}

/**
 * @param {string} refreshToken
 */
export async function refreshDiscordAccessToken(refreshToken) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    const err = new Error("Discord OAuth is not configured on the server.");
    err.status = 500;
    err.code = "discord_oauth_misconfigured";
    throw err;
  }
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  let data;
  try {
    data = await res.json();
  } catch {
    const err = new Error("Invalid token response from Discord.");
    err.status = 502;
    err.code = "discord_token_bad_response";
    throw err;
  }
  if (!res.ok) {
    const err = new Error(data?.error_description || data?.message || "Could not refresh Discord session. Please reconnect Discord.");
    err.status = 401;
    err.code = "discord_token_refresh_failed";
    throw err;
  }
  const scopes =
    typeof data.scope === "string"
      ? data.scope.split(/[\s+]+/).filter(Boolean)
      : Array.isArray(data.scope)
        ? data.scope
        : [];
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresIn: typeof data.expires_in === "number" ? data.expires_in : 604800,
    tokenType: data.token_type || "Bearer",
    scopes,
  };
}

/**
 * @param {string} userAccessToken
 * @returns {Promise<Set<string>>}
 */
export async function fetchDiscordUserGuildIds(userAccessToken) {
  const res = await fetch(`${DISCORD_API}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${userAccessToken}` },
  });
  let data;
  try {
    data = await res.json();
  } catch {
    const err = new Error("Discord returned an unreadable guild list.");
    err.status = 502;
    err.code = "discord_guilds_bad_response";
    throw err;
  }
  if (!res.ok) {
    const msg =
      res.status === 401
        ? "Discord session expired. Please reconnect your Discord account."
        : typeof data?.message === "string"
          ? data.message
          : "Could not load your Discord servers.";
    const err = new Error(msg);
    err.status = res.status === 401 ? 401 : 403;
    err.code = "discord_guilds_failed";
    throw err;
  }
  if (!Array.isArray(data)) {
    const err = new Error("Unexpected Discord guild list format.");
    err.status = 502;
    err.code = "discord_guilds_invalid";
    throw err;
  }
  return new Set(data.map((g) => String(g?.id || "").trim()).filter(Boolean));
}

/**
 * @param {string} botToken
 * @param {string} channelId
 * @returns {Promise<{ guild_id: string, name?: string, type?: number }>}
 */
export async function fetchDiscordChannelWithBot(botToken, channelId) {
  const res = await fetch(`${DISCORD_API}/channels/${channelId}`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
  let data;
  try {
    data = await res.json();
  } catch {
    const err = new Error("Discord returned an unreadable channel response.");
    err.status = 502;
    err.code = "discord_channel_bad_response";
    throw err;
  }
  if (!res.ok) {
    const err = new Error(mapDiscordSendErrorMessage(res.status, data));
    err.status = res.status >= 400 && res.status < 600 ? res.status : 502;
    err.code = "discord_channel_failed";
    throw err;
  }
  const gid = String(data?.guild_id || "").trim();
  if (!gid) {
    const err = new Error("That channel is not a guild channel or the bot cannot access it.");
    err.status = 403;
    err.code = "discord_channel_no_guild";
    throw err;
  }
  return { guild_id: gid, name: data?.name, type: data?.type };
}

/**
 * @param {number} status
 * @param {unknown} data
 */
export function mapDiscordSendErrorMessage(status, data) {
  const code = typeof data?.code === "number" ? data.code : null;
  const msg = typeof data?.message === "string" ? data.message : "";
  const lower = msg.toLowerCase();
  if (code === 50001 || lower.includes("missing access")) {
    return "The bot cannot access this channel. Confirm the bot is in the server and can view the channel.";
  }
  if (code === 50013 || lower.includes("missing permissions")) {
    return "The bot lacks permission to send messages in this channel (needs Send Messages and, for embeds, Embed Links).";
  }
  if (code === 10003 || lower.includes("unknown channel")) {
    return "Channel not found or the bot is not in this server.";
  }
  if (status === 401) {
    return "Discord rejected the bot token. Check DISCORD_BOT_TOKEN on the server.";
  }
  if (msg) return msg;
  return "Discord rejected this message.";
}

/**
 * @param {object} parsed — normalized / validated post fields
 * @returns {Record<string, unknown>}
 */
export function buildDiscordMessagePayload(parsed) {
  const {
    message,
    mediaType,
    mediaUrl,
    linkUrl,
    embedTitle,
    embedDescription,
    embedUrl,
  } = parsed;

  /** @type {Record<string, unknown>[]} */
  const embeds = [];

  const trimmedMsg = message;
  const trimLink = linkUrl;
  const trimMedia = mediaUrl;
  const trimEmbedTitle = embedTitle;
  const trimEmbedDesc = embedDescription;
  const trimEmbedUrl = embedUrl;

  let content = "";

  if (mediaType === "TEXT") {
    if (trimmedMsg && trimLink && isValidDiscordHttpUrl(trimLink)) {
      content = `${trimmedMsg}\n${trimLink}`.slice(0, 2000);
    } else if (trimmedMsg) {
      content = trimmedMsg.slice(0, 2000);
    } else if (trimLink && isValidDiscordHttpUrl(trimLink)) {
      content = trimLink.slice(0, 2000);
    }

    const aux = {};
    if (trimEmbedTitle) aux.title = trimEmbedTitle.slice(0, 256);
    if (trimEmbedDesc) aux.description = trimEmbedDesc.slice(0, 4096);
    if (trimEmbedUrl && isValidDiscordHttpUrl(trimEmbedUrl)) aux.url = trimEmbedUrl;
    if (trimMedia && isValidDiscordHttpUrl(trimMedia)) aux.image = { url: trimMedia };
    if (Object.keys(aux).length) embeds.push(aux);
  }

  if (mediaType === "LINK") {
    const emb = {
      url: trimLink,
      description: (trimEmbedDesc || trimmedMsg || trimLink).slice(0, 4096),
    };
    if (trimEmbedTitle) emb.title = trimEmbedTitle.slice(0, 256);
    if (trimMedia && isValidDiscordHttpUrl(trimMedia)) emb.image = { url: trimMedia };
    embeds.push(emb);
    content = trimmedMsg.slice(0, 2000);
  }

  if (mediaType === "IMAGE") {
    const emb = { image: { url: trimMedia } };
    if (trimEmbedTitle) emb.title = trimEmbedTitle.slice(0, 256);
    if (trimEmbedDesc) emb.description = trimEmbedDesc.slice(0, 4096);
    if (trimEmbedUrl && isValidDiscordHttpUrl(trimEmbedUrl)) emb.url = trimEmbedUrl;
    embeds.push(emb);
    content = trimmedMsg.slice(0, 2000);
  }

  if (mediaType === "EMBED") {
    const emb = {};
    if (trimEmbedTitle) emb.title = trimEmbedTitle.slice(0, 256);
    if (trimEmbedDesc) emb.description = trimEmbedDesc.slice(0, 4096);
    if (trimEmbedUrl && isValidDiscordHttpUrl(trimEmbedUrl)) emb.url = trimEmbedUrl;
    if (trimMedia && isValidDiscordHttpUrl(trimMedia)) emb.image = { url: trimMedia };
    embeds.push(emb);
    content = trimmedMsg.slice(0, 2000);
  }

  /** @type {Record<string, unknown>} */
  const body = {};
  if (content) body.content = content;
  if (embeds.length) body.embeds = embeds;

  return body;
}

/**
 * @param {Record<string, unknown>} body
 */
function assertDiscordPayloadNonEmpty(body) {
  const hasContent = typeof body.content === "string" && body.content.length > 0;
  const hasEmbeds = Array.isArray(body.embeds) && body.embeds.length > 0;
  if (!hasContent && !hasEmbeds) {
    const err = new Error("Nothing to send after building the Discord payload.");
    err.status = 400;
    err.code = "discord_payload_empty";
    throw err;
  }
}

/**
 * @param {string} botToken
 * @param {string} channelId
 * @param {Record<string, unknown>} body
 * @returns {Promise<{ messageId: string, safePayload: object }>}
 */
export async function publishDiscordViaBot(botToken, channelId, body) {
  assertDiscordPayloadNonEmpty(body);
  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  let data;
  try {
    data = await res.json();
  } catch {
    const err = new Error("Discord returned an unreadable message response.");
    err.status = 502;
    err.code = "discord_message_bad_response";
    throw err;
  }
  if (!res.ok) {
    const err = new Error(mapDiscordSendErrorMessage(res.status, data));
    err.status = res.status >= 400 && res.status < 600 ? res.status : 502;
    err.code = "discord_post_failed";
    throw err;
  }
  const messageId = data?.id != null ? String(data.id) : "";
  if (!messageId) {
    const err = new Error("Discord did not return a message id.");
    err.status = 502;
    err.code = "discord_post_no_id";
    throw err;
  }
  return { messageId, safePayload: { id: messageId } };
}

/**
 * @param {string} executeUrl — https://discord.com/api/webhooks/{id}/{token}
 * @param {Record<string, unknown>} body
 * @returns {Promise<{ messageId: string, safePayload: object }>}
 */
export async function publishDiscordViaWebhook(executeUrl, body) {
  assertDiscordPayloadNonEmpty(body);
  const url = executeUrl.includes("?") ? `${executeUrl}&wait=true` : `${executeUrl}?wait=true`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data;
  try {
    data = await res.json();
  } catch {
    const err = new Error("Discord webhook returned an unreadable response.");
    err.status = 502;
    err.code = "discord_webhook_bad_response";
    throw err;
  }
  if (!res.ok) {
    const err = new Error(mapDiscordSendErrorMessage(res.status, data));
    err.status = res.status >= 400 && res.status < 600 ? res.status : 502;
    err.code = "discord_webhook_failed";
    throw err;
  }
  const messageId = data?.id != null ? String(data.id) : "";
  return { messageId: messageId || "webhook", safePayload: messageId ? { id: messageId } : {} };
}
