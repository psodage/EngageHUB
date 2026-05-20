const telegramService = {
  platform: "telegram",
  validateConfig() {
    const missing = [];
    if (!process.env.TELEGRAM_BOT_TOKEN) missing.push("TELEGRAM_BOT_TOKEN");
    if (!process.env.TELEGRAM_BOT_USERNAME) missing.push("TELEGRAM_BOT_USERNAME");
    return { valid: missing.length === 0, missing };
  },
  getAuthUrl() {
    throw new Error("Telegram uses bot-based setup, not OAuth. Configure bot token and group/channel mapping.");
  },
  async exchangeCodeForToken() {
    throw new Error("Telegram bot setup does not use OAuth code exchange.");
  },
  async getProfile() {
    return {
      platformUserId: process.env.TELEGRAM_BOT_USERNAME || "",
      accountName: process.env.TELEGRAM_BOT_USERNAME || "Telegram Bot",
      username: process.env.TELEGRAM_BOT_USERNAME || "",
      email: "",
      profileImage: "",
      metadata: { capabilities: ["posting", "limited-api", "bot-based"] },
    };
  },
  async getManagedEntities() {
    return [];
  },
  async publishPost() {
    throw new Error("Telegram publishing requires bot/group mapping. Coming soon.");
  },
  async getAnalytics() {
    return { available: false, reason: "Telegram Bot API does not provide native analytics for groups/channels." };
  },
  async refreshTokenIfNeeded() {
    return null;
  },
  async disconnectAccount() {
    return { disconnected: true };
  },
};

export default telegramService;
