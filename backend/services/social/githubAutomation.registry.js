/**
 * Registry for future GitHub → social automation workflows.
 * Handlers are stubs until automation features ship; routes/services call `runGitHubAutomation`.
 */

export const GITHUB_AUTOMATION_TYPES = {
  README_UPDATE: "readme_update",
  REPO_POST: "repo_post",
  RELEASE_NOTIFY: "release_notify",
  ISSUE_ALERT: "issue_alert",
  COMMIT_TO_SOCIAL: "commit_to_social",
  CROSS_POST_LINKEDIN: "cross_post_linkedin",
  CROSS_POST_X: "cross_post_x",
};

const automationHandlers = {
  [GITHUB_AUTOMATION_TYPES.README_UPDATE]: async () => ({
    status: "not_implemented",
    message: "Automatic README updates will be available in a future release.",
  }),
  [GITHUB_AUTOMATION_TYPES.REPO_POST]: async () => ({
    status: "not_implemented",
    message: "Repository posting automation is not enabled yet.",
  }),
  [GITHUB_AUTOMATION_TYPES.RELEASE_NOTIFY]: async () => ({
    status: "not_implemented",
    message: "Release notifications are not enabled yet.",
  }),
  [GITHUB_AUTOMATION_TYPES.ISSUE_ALERT]: async () => ({
    status: "not_implemented",
    message: "Issue alerts are not enabled yet.",
  }),
  [GITHUB_AUTOMATION_TYPES.COMMIT_TO_SOCIAL]: async () => ({
    status: "not_implemented",
    message: "Commit-to-social sharing is not enabled yet.",
  }),
  [GITHUB_AUTOMATION_TYPES.CROSS_POST_LINKEDIN]: async () => ({
    status: "not_implemented",
    message: "GitHub → LinkedIn automation is not enabled yet.",
  }),
  [GITHUB_AUTOMATION_TYPES.CROSS_POST_X]: async () => ({
    status: "not_implemented",
    message: "GitHub → X automation is not enabled yet.",
  }),
};

/**
 * @param {string} type One of GITHUB_AUTOMATION_TYPES
 * @param {{ userId: import("mongodb").ObjectId, account: object, payload?: object }} context
 */
export async function runGitHubAutomation(type, context = {}) {
  const handler = automationHandlers[type];
  if (!handler) {
    return { status: "unknown_type", message: `Unknown automation type: ${type}` };
  }
  return handler(context);
}

export function listGitHubAutomationCapabilities() {
  return Object.entries(GITHUB_AUTOMATION_TYPES).map(([key, type]) => ({
    key,
    type,
    available: false,
    description: automationHandlers[type]
      ? "Planned — register handler when feature ships."
      : "Unknown",
  }));
}
