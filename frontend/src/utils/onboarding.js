export function getOnboardingRoute(user) {
  if (!user) return "/onboarding/user-type";
  if (user.onboardingCompleted) {
    if (user.userType === "influencer") return "/dashboard/influencer";
    if (user.userType === "student") return "/dashboard/student";
    return "/dashboard/business";
  }
  if (!user.userType) return "/onboarding/user-type";
  if (!user.profileSetup?.completed) return "/onboarding/profile-setup";
  return "/onboarding/link-accounts";
}

export function normalizeOnboardingUser(payloadUser = {}) {
  return {
    email: payloadUser.email || "",
    name: payloadUser.name || "Alex Morgan",
    userType: payloadUser.userType === "business" || payloadUser.userType === "influencer" || payloadUser.userType === "student" ? payloadUser.userType : "",
    onboardingCompleted: Boolean(payloadUser.onboardingCompleted),
    profileSetup: { completed: Boolean(payloadUser.profileSetup?.completed) },
    businessProfile: payloadUser.businessProfile || {},
    influencerProfile: payloadUser.influencerProfile || {},
    studentProfile: payloadUser.studentProfile || {},
    linkedAccounts: Array.isArray(payloadUser.linkedAccounts) ? payloadUser.linkedAccounts : [],
  };
}
