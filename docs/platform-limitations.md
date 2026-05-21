# EngageHub Platform Limitations (Official APIs)

- **Facebook**: **Pages only** for API publishing (`pages_manage_posts`). Personal profile timeline posting was removed by Meta (Graph API v2.4+); reconnecting cannot restore it.
- **Instagram**: Supports professional accounts linked through Meta graph permissions.
- **Threads**: Supports profile publishing and insights where available by app permissions.
- **LinkedIn**: Profile publishing supported; organization/page support depends on app review scopes.
- **X (Twitter)**: Posting supported; analytics availability depends on API tier and entitlements.
- **Reddit**: Community posting depends on granted scopes and subreddit rules.
- **Pinterest**: Pin publishing + board workflows supported with required media payloads.
- **Telegram**: Bot-based integration only; no direct end-user OAuth flow.
- **Discord**: OAuth + webhook/bot channel flow; analytics is limited via official API.
- **Google Business Profile**: Business/location updates require selected verified location and approved scopes.
