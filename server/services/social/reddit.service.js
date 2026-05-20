import { createOAuthService } from "./sharedOAuth.js";
import { resolveProviderRedirectUri } from "../../utils/redirectUri.util.js";

const redditService = createOAuthService({
  platform: "reddit",
  clientId: process.env.REDDIT_CLIENT_ID,
  clientSecret: process.env.REDDIT_CLIENT_SECRET,
  redirectUri: resolveProviderRedirectUri("reddit"),
  authUrl: "https://www.reddit.com/api/v1/authorize",
  tokenUrl: "https://www.reddit.com/api/v1/access_token",
  profileUrl: "https://oauth.reddit.com/api/v1/me",
  scopes: ["identity", "submit", "read", "mysubreddits"],
  additionalAuthParams: { duration: "permanent" },
  mapProfile: (data, normalized) => ({
    ...normalized,
    platformUserId: data?.id?.toString() || normalized.platformUserId,
    accountName: data?.name || normalized.accountName,
    username: data?.name || normalized.username,
    profileImage: data?.icon_img || normalized.profileImage,
    metadata: {
      ...normalized.metadata,
      capabilities: ["posting", "limited-api", "community-posting"],
    },
  }),
});

export default redditService;
