export const POST_TEMPLATE_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "launch", label: "Launch" },
  { id: "engagement", label: "Engagement" },
  { id: "education", label: "Tips" },
  { id: "promo", label: "Promo" },
  { id: "story", label: "Story" },
];

/** Curated starter templates shown in Create post (keep count between 4–6). */
export const POST_IDEA_TEMPLATES = [
  {
    id: "launch-teaser",
    category: "launch",
    title: "Product launch teaser",
    caption:
      "Something new is coming. We've been building in the open—and the wait is almost over.\n\nDrop a 🔥 if you want early access.",
    hashtags: ["#ComingSoon", "#ProductLaunch", "#BuildInPublic"],
  },
  {
    id: "engagement-question",
    category: "engagement",
    title: "Open question",
    caption: "What's one thing you wish {{topic}} did better?\n\nGenuinely curious—drop your take below.",
    hashtags: ["#AskMe", "#Community"],
  },
  {
    id: "education-tip",
    category: "education",
    title: "3 quick tips",
    caption:
      "3 {{topic}} tips that saved me hours this week:\n\n1. {{tip1}}\n2. {{tip2}}\n3. {{tip3}}\n\nSave this for later.",
    hashtags: ["#Tips", "#HowTo", "#LearnOnSocial"],
  },
  {
    id: "promo-limited",
    category: "promo",
    title: "Limited offer",
    caption:
      "48 hours only: {{offer}}\n\nUse code {{code}} at checkout.\n\nEnds {{deadline}}—don't sleep on this.",
    hashtags: ["#Sale", "#LimitedOffer"],
  },
  {
    id: "story-milestone",
    category: "story",
    title: "Milestone celebration",
    caption: "We hit {{milestone}}.\n\nThank you for being part of this journey. Onward. 🙌",
    hashtags: ["#Milestone", "#Grateful"],
  },
  {
    id: "launch-live",
    category: "launch",
    title: "We're live",
    caption:
      "We're live.\n\n{{product}} is here to help you {{benefit}}—without the usual hassle.\n\nTry it today → {{link}}",
    hashtags: ["#LaunchDay", "#NewProduct"],
  },
];

export const AI_TONE_OPTIONS = [
  { id: "professional", label: "Professional" },
  { id: "casual", label: "Casual" },
  { id: "playful", label: "Playful" },
  { id: "urgent", label: "Urgent" },
  { id: "inspirational", label: "Inspirational" },
];

export const AI_GOAL_OPTIONS = [
  { id: "engage", label: "Drive engagement" },
  { id: "sell", label: "Promote offer" },
  { id: "educate", label: "Educate" },
  { id: "announce", label: "Announce news" },
];
