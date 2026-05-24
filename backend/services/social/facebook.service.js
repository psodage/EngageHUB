import { createMetaOAuthService, META_SCOPE_SETS } from "./meta.service.js";

function parseCommaSeparatedScopes(raw) {
  return String(raw || "")
    .split(/[,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Default: scopes every Meta app accepts. Page scopes often trigger “Invalid Scopes” until enabled in App Dashboard.
// Optional: FACEBOOK_LOGIN_EXTRA_SCOPES=pages_show_list,pages_read_engagement,pages_manage_posts (comma-separated)
const facebookLoginScopes = [
  ...META_SCOPE_SETS.initialLogin,
  ...parseCommaSeparatedScopes(process.env.FACEBOOK_LOGIN_EXTRA_SCOPES),
];

const facebookService = createMetaOAuthService({
  platform: "facebook",
  profileFields: "id,name,email,picture",
  scopes: facebookLoginScopes,
});

export default facebookService;
