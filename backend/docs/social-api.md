# Social Accounts Module

## Folder Structure

```txt
backend/
  controllers/social.controller.js
  models/SocialAccount.js
  routes/social.routes.js
  services/social/
    facebook.service.js
    instagram.service.js
    linkedin.service.js
    providerRegistry.js
    sharedOAuth.js
    socialAccount.service.js
    threads.service.js
    youtube.service.js
  utils/
    apiResponse.js
    crypto.js
    oauthState.js
```

## API Response Shape

All social endpoints return:

```json
{
  "success": true,
  "message": "Fetched social accounts.",
  "data": { "accounts": [] },
  "error": null
}
```

Failure shape:

```json
{
  "success": false,
  "message": "Unable to fetch connected accounts.",
  "data": null,
  "error": "Invalid authentication token."
}
```

## Example Accounts Response

```json
{
  "success": true,
  "message": "Fetched social accounts.",
  "data": {
    "accounts": [
      {
        "platform": "instagram",
        "isConnected": true,
        "accountName": "EngageHub IG",
        "username": "engagehubhq",
        "profileImage": "https://example.com/avatar.png",
        "isTokenExpired": false,
        "lastSyncedAt": "2026-04-18T12:01:00.000Z"
      },
      { "platform": "facebook", "isConnected": false }
    ]
  },
  "error": null
}
```

## Dummy Frontend Data

You can hardcode this in UI tests:

```js
export const mockSocialAccounts = [
  { platform: "instagram", isConnected: true, accountName: "EngageHub IG", isTokenExpired: false, lastSyncedAt: new Date().toISOString() },
  { platform: "facebook", isConnected: false },
  { platform: "threads", isConnected: false },
  { platform: "linkedin", isConnected: true, accountName: "EngageHub Team", isTokenExpired: true, lastSyncedAt: new Date().toISOString() },
  { platform: "youtube", isConnected: false },
];
```
