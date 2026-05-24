import { POST_IDEA_TEMPLATES } from "../data/postIdeasTemplates";

const TONE_OPENERS = {
  professional: ["Here's what we've learned:", "A quick update on", "We're excited to share"],
  casual: ["Real talk:", "Okay so", "Quick one:"],
  playful: ["Plot twist:", "No cap —", "POV:"],
  urgent: ["Last chance:", "Don't miss this:", "Ending soon:"],
  inspirational: ["Remember:", "Your reminder that", "Small steps:"],
};

const GOAL_BODIES = {
  engage: (topic) =>
    `What's your take on ${topic}? Drop a comment—we read every one.`,
  sell: (topic) =>
    `Ready to level up your ${topic}? Link in bio · Limited spots this week.`,
  educate: (topic) =>
    `3 things about ${topic} most people overlook:\n\n→ Start simple\n→ Stay consistent\n→ Measure what matters`,
  announce: (topic) =>
    `Big news about ${topic}—more details coming soon. Turn on notifications so you don't miss it.`,
};

const HASHTAG_POOLS = {
  general: ["#ContentCreator", "#SocialMedia", "#Marketing"],
  engage: ["#Community", "#LetsTalk", "#Engagement"],
  sell: ["#ShopNow", "#Offer", "#LimitedTime"],
  educate: ["#Tips", "#LearnSomethingNew", "#HowTo"],
  announce: ["#News", "#Update", "#Announcement"],
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fillPlaceholders(text, vars = {}) {
  const defaults = {
    product: "our product",
    benefit: "save time",
    link: "link in bio",
    topic: vars.topic || "your niche",
    question: "Which format do you prefer?",
    optionA: "Short posts",
    optionB: "Long-form",
    tip1: "Plan one week ahead",
    tip2: "Batch your content",
    tip3: "Repurpose across channels",
    myth: "You need to post daily",
    fact: "Consistency beats frequency",
    offer: "20% off your first order",
    code: "SAVE20",
    deadline: "Sunday midnight",
    number: "500",
    customer: "a happy customer",
    quote: "This changed how we work.",
    project: "our latest launch",
    challenge: "hit a few roadblocks",
    win: "shipped anyway",
    milestone: "10K followers",
    role: "Content Marketer",
    focus: "social strategy",
    location: "Worldwide",
    time: "6 months",
    count: "5",
    opinion: "quality beats quantity",
    company: "our team",
    hook: "surprise",
    cta: "Tap the link to learn more",
    niche: "growth",
    ...vars,
  };
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => defaults[key] ?? `{{${key}}}`);
}

export function applyTemplate(template, vars = {}) {
  const caption = fillPlaceholders(template.caption, vars);
  const tags = (template.hashtags || []).join(" ");
  return tags ? `${caption}\n\n${tags}` : caption;
}

export function generateLocalCaptions({ topic = "", tone = "casual", goal = "engage", platform = "" }) {
  const t = topic.trim() || "your brand";
  const opener = pick(TONE_OPENERS[tone] || TONE_OPENERS.casual);
  const bodyFn = GOAL_BODIES[goal] || GOAL_BODIES.engage;
  const tags = [...(HASHTAG_POOLS[goal] || []), ...HASHTAG_POOLS.general].slice(0, 4).join(" ");

  const variants = [
    `${opener} ${t}.\n\n${bodyFn(t)}\n\n${tags}`,
    `Hot take on ${t}:\n\nThe brands winning right now aren't louder—they're clearer.\n\nAgree or disagree? 👇\n\n${tags}`,
    `Save this for your next ${platform || "social"} post about ${t}:\n\n• Hook in line 1\n• One clear CTA\n• Reply to early comments\n\n${tags}`,
  ];

  return variants.map((caption, index) => ({
    id: `local-${index}`,
    caption,
    source: "local",
  }));
}

export function improveCaption(caption, action) {
  const text = (caption || "").trim();
  if (!text) return "";

  switch (action) {
    case "shorten": {
      const lines = text.split("\n").filter(Boolean);
      if (lines.length <= 2) return text.slice(0, Math.min(text.length, 200));
      return `${lines[0]}\n\n${lines[lines.length - 1]}`;
    }
    case "hashtags": {
      if (text.includes("#")) return text;
      return `${text}\n\n#SocialMedia #ContentStrategy #Growth`;
    }
    case "cta": {
      if (/link in bio|comment|share|save/i.test(text)) return text;
      return `${text}\n\nWhat do you think? Let us know below 👇`;
    }
    case "emoji": {
      if (/[\u{1F300}-\u{1FAFF}]/u.test(text)) return text;
      return `${text}\n\n✨`;
    }
    default:
      return text;
  }
}

export function getTemplatesForPlatform(platform, categoryId = "all") {
  return POST_IDEA_TEMPLATES.filter((tpl) => {
    if (categoryId !== "all" && tpl.category !== categoryId) return false;
    if (tpl.platforms?.length && platform && !tpl.platforms.includes(platform)) return false;
    return true;
  });
}
