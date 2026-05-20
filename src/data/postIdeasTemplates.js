export const POST_TEMPLATE_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "launch", label: "Launch" },
  { id: "engagement", label: "Engagement" },
  { id: "education", label: "Education" },
  { id: "promo", label: "Promo" },
  { id: "story", label: "Story" },
  { id: "hiring", label: "Hiring" },
];

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
    id: "launch-live",
    category: "launch",
    title: "We're live announcement",
    caption:
      "We're live.\n\n{{product}} is here to help you {{benefit}}—without the usual hassle.\n\nTry it today → {{link}}",
    hashtags: ["#LaunchDay", "#NewProduct"],
  },
  {
    id: "engagement-poll",
    category: "engagement",
    title: "Quick poll",
    caption: "Quick question for you:\n\n{{question}}\n\nA) {{optionA}}\nB) {{optionB}}\n\nVote in the comments 👇",
    hashtags: ["#Poll", "#Community"],
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
    id: "education-myth",
    category: "education",
    title: "Myth vs fact",
    caption: "Myth: {{myth}}\n\nFact: {{fact}}\n\nWhich surprised you most?",
    hashtags: ["#MythBusting", "#DidYouKnow"],
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
    id: "promo-social-proof",
    category: "promo",
    title: "Social proof",
    caption:
      "{{number}}+ teams already use {{product}} to {{benefit}}.\n\nHere's what {{customer}} said:\n\n\"{{quote}}\"",
    hashtags: ["#CustomerLove", "#Testimonial"],
  },
  {
    id: "story-behind",
    category: "story",
    title: "Behind the scenes",
    caption:
      "Behind the scenes of {{project}}:\n\nWe {{challenge}}—then {{win}}.\n\nGrateful for everyone who cheered us on.",
    hashtags: ["#BTS", "#FounderStory"],
  },
  {
    id: "story-milestone",
    category: "story",
    title: "Milestone celebration",
    caption: "We hit {{milestone}}.\n\nThank you for being part of this journey. Onward. 🙌",
    hashtags: ["#Milestone", "#Grateful"],
  },
  {
    id: "hiring-role",
    category: "hiring",
    title: "We're hiring",
    caption:
      "We're hiring a {{role}}.\n\nYou'll work on {{focus}} with a team that cares about craft.\n\nRemote-friendly · {{location}}\n\nDM or apply: {{link}}",
    hashtags: ["#Hiring", "#JoinUs"],
  },
  {
    id: "threads-hook",
    category: "engagement",
    title: "Thread hook",
    caption: "I spent {{time}} learning {{topic}}.\n\nHere are {{count}} lessons I'd share with my past self 🧵",
    hashtags: ["#Thread"],
    platforms: ["threads", "x"],
  },
  {
    id: "linkedin-thought",
    category: "education",
    title: "LinkedIn thought leadership",
    caption:
      "Unpopular opinion: {{opinion}}\n\nHere's why—and what we're doing differently at {{company}}.",
    hashtags: ["#Leadership", "#Career"],
    platforms: ["linkedin"],
  },
  {
    id: "instagram-reel",
    category: "promo",
    title: "Reel / short video CTA",
    caption: "Watch till the end for the {{hook}} 👀\n\n{{cta}}\n\nSave · Share · Follow for more {{niche}} content",
    hashtags: ["#Reels", "#ContentCreator"],
    platforms: ["instagram"],
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
