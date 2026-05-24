import { createOAuthService } from "./sharedOAuth.js";
import { resolveProviderRedirectUri } from "../../utils/redirectUri.util.js";

const discordService = createOAuthService({
  platform: "discord",
  clientId: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  redirectUri: resolveProviderRedirectUri("discord"),
  authUrl: "https://discord.com/oauth2/authorize",
  tokenUrl: "https://discord.com/api/oauth2/token",
  profileUrl: "https://discord.com/api/users/@me",
  scopes: ["identify", "guilds", "webhook.incoming"],
  mapProfile: (data, normalized) => ({
    ...normalized,
    platformUserId: data?.id?.toString() || normalized.platformUserId,
    accountName: data?.global_name || data?.username || normalized.accountName,
    username: data?.username || normalized.username,
    profileImage: data?.avatar ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png` : normalized.profileImage,
    metadata: {
      ...normalized.metadata,
      capabilities: ["posting", "messaging", "limited-api"],
    },
  }),
});

export default discordService;
