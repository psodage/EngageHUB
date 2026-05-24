import { createOAuthService } from "./sharedOAuth.js";
import { resolveProviderRedirectUri } from "../../utils/redirectUri.util.js";

const pinterestService = createOAuthService({
  platform: "pinterest",
  clientId: process.env.PINTEREST_APP_ID,
  clientSecret: process.env.PINTEREST_APP_SECRET,
  redirectUri: resolveProviderRedirectUri("pinterest"),
  authUrl: "https://www.pinterest.com/oauth/",
  tokenUrl: "https://api.pinterest.com/v5/oauth/token",
  profileUrl: "https://api.pinterest.com/v5/user_account",
  scopes: ["boards:read", "pins:read", "pins:write", "user_accounts:read"],
  mapProfile: (data, normalized) => ({
    ...normalized,
    platformUserId: data?.id?.toString() || normalized.platformUserId,
    accountName: data?.username || data?.id || normalized.accountName,
    username: data?.username || normalized.username,
    profileImage: data?.profile_image || normalized.profileImage,
    metadata: {
      ...normalized.metadata,
      capabilities: ["posting", "analytics"],
    },
  }),
});

export default pinterestService;
