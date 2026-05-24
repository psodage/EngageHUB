const TELEGRAM_API_BASE = "https://api.telegram.org";

/**
 * Escape text for Telegram Bot API parse_mode HTML (user content treated as plain text).
 * @param {string} value
 */
export function escapeTelegramHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildInlineKeyboard(buttonText, buttonUrl) {
  const text = String(buttonText || "").trim();
  const url = String(buttonUrl || "").trim();
  if (!text || !url) return undefined;
  return {
    inline_keyboard: [[{ text: text.slice(0, 64), url: url.slice(0, 2048) }]],
  };
}

/**
 * @param {unknown} json
 * @returns {string}
 */
export function mapTelegramClientError(json) {
  if (!json || typeof json !== "object") {
    return "Telegram did not accept this request. Check the bot token and chat ID.";
  }
  const desc = typeof json.description === "string" ? json.description : "";
  const lower = desc.toLowerCase();
  if (lower.includes("not enough rights") || lower.includes("need administrator")) {
    return "The bot needs permission to post in this channel or group. For channels, add the bot as an administrator with “Post messages”.";
  }
  if (lower.includes("not a member") || lower.includes("chat not found")) {
    return "The bot is not in this chat or the chat ID is wrong. Add the bot to the group or channel first.";
  }
  if (lower.includes("blocked")) {
    return "Telegram blocked this action (the bot may have been removed or blocked).";
  }
  if (lower.includes("wrong file") || lower.includes("failed to get http url content")) {
    return "Telegram could not fetch the media URL. Use a direct https link or upload the file instead.";
  }
  if (lower.includes("message text is empty")) {
    return "Telegram requires non-empty text for this message type.";
  }
  if (lower.includes("unauthorized") || json.error_code === 401) {
    return "Telegram rejected the bot token. Reconnect Telegram with a valid bot token.";
  }
  if (desc) return desc;
  return "Telegram API request failed.";
}

async function callTelegram(botToken, method, payload) {
  const url = `${TELEGRAM_API_BASE}/bot${botToken}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  let json;
  try {
    json = await res.json();
  } catch {
    const err = new Error("Invalid response from Telegram.");
    err.status = 502;
    err.code = "telegram_bad_response";
    throw err;
  }
  if (!json?.ok) {
    const err = new Error(mapTelegramClientError(json));
    err.status = json.error_code === 401 ? 401 : json.error_code === 403 ? 403 : 400;
    err.code = "telegram_api_error";
    err.telegramErrorCode = json.error_code;
    throw err;
  }
  return json;
}

/**
 * @param {object} opts
 * @param {string} opts.botToken
 * @param {string} opts.chatId
 * @param {string} opts.message
 * @param {"TEXT"|"IMAGE"|"VIDEO"|"DOCUMENT"|"LINK"} opts.mediaType
 * @param {string} opts.mediaUrl
 * @param {string} opts.linkUrl
 * @param {string} opts.buttonText
 * @param {string} opts.buttonUrl
 */
export async function publishTelegramPost(opts) {
  const {
    botToken,
    chatId,
    message = "",
    mediaType,
    mediaUrl = "",
    linkUrl = "",
    buttonText = "",
    buttonUrl = "",
  } = opts;

  const replyMarkup = buildInlineKeyboard(buttonText, buttonUrl);
  const m = String(message || "").trim();
  const l = String(linkUrl || "").trim();
  const caption = m ? escapeTelegramHtml(m) : undefined;

  const composeMessageText = () => {
    if (mediaType === "LINK") {
      if (m && l) return `${escapeTelegramHtml(m)}\n${escapeTelegramHtml(l)}`;
      if (m) return escapeTelegramHtml(m);
      return escapeTelegramHtml(l);
    }
    if (mediaType === "TEXT") {
      if (m && l) return `${escapeTelegramHtml(m)}\n${escapeTelegramHtml(l)}`;
      if (m) return escapeTelegramHtml(m);
      if (l) return escapeTelegramHtml(l);
      return "";
    }
    return escapeTelegramHtml(m);
  };

  const textForSend = composeMessageText();

  /** @type {Record<string, unknown>} */
  const base = {
    chat_id: chatId,
    parse_mode: "HTML",
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  };

  let method = "sendMessage";
  /** @type {Record<string, unknown>} */
  let body = { ...base, text: textForSend };

  if (mediaType === "IMAGE") {
    method = "sendPhoto";
    body = {
      chat_id: chatId,
      photo: mediaUrl.trim(),
      parse_mode: "HTML",
      ...(caption ? { caption } : {}),
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    };
  } else if (mediaType === "VIDEO") {
    method = "sendVideo";
    body = {
      chat_id: chatId,
      video: mediaUrl.trim(),
      parse_mode: "HTML",
      ...(caption ? { caption } : {}),
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    };
  } else if (mediaType === "DOCUMENT") {
    method = "sendDocument";
    body = {
      chat_id: chatId,
      document: mediaUrl.trim(),
      parse_mode: "HTML",
      ...(caption ? { caption } : {}),
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    };
  } else if (mediaType === "TEXT") {
    body = {
      chat_id: chatId,
      text: textForSend,
      parse_mode: "HTML",
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    };
  }
  // LINK uses sendMessage like TEXT (textForSend already includes link)

  const json = await callTelegram(botToken, method, body);
  const msg = json.result && typeof json.result === "object" ? json.result : {};
  const messageId = msg.message_id != null ? String(msg.message_id) : "";
  return {
    messageId,
    safePayload: { message_id: messageId },
  };
}
