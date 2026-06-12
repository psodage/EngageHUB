export function normalizeOAuthFlow(flowParam) {
  if (flowParam === "onboarding") return "onboarding";
  if (flowParam === "channels") return "channels";
  return "settings";
}

export function getOAuthReturnPath(flow) {
  if (flow === "onboarding") return "/onboarding/link-accounts";
  if (flow === "channels") return "/channels";
  return "/settings";
}
