const TONE_OPENERS = {
  professional: "Here's an update on",
  casual: "Quick thought on",
  playful: "Plot twist about",
  urgent: "Don't miss this on",
  inspirational: "A reminder about",
};

export function generateCaptionVariants({ topic = "", tone = "casual", goal = "engage", platform = "" }) {
  const t = topic.trim() || "your brand";
  const opener = TONE_OPENERS[tone] || TONE_OPENERS.casual;
  const plat = platform ? ` for ${platform}` : "";

  return [
    `${opener} ${t}${plat}.\n\nWe'd love your take—comment below.\n\n#SocialMedia #ContentStrategy`,
    `${t}: 3 ideas to try this week\n\n1. Lead with a hook\n2. One CTA only\n3. Reply fast\n\n#Marketing #Growth`,
    `Why ${t} matters right now—and what we're doing about it.\n\nSave · Share · Follow for more.`,
  ];
}

export async function generateWithOpenAI({ topic, tone, goal, platform }, apiKey) {
  const prompt = `Write 3 distinct social media captions.
Topic: ${topic || "general brand"}
Tone: ${tone}
Goal: ${goal}
Platform: ${platform || "general"}
Rules: No quotes around output. Separate variants with "---". Under 280 words each unless platform is linkedin. Include line breaks. Optional 2-3 hashtags at end.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a social media copywriter like Buffer. Output only caption text." },
        { role: "user", content: prompt },
      ],
      temperature: 0.85,
      max_tokens: 900,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(err || "OpenAI request failed");
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content?.trim() || "";
  const parts = content.split(/\n---\n|\n\n---\n\n/).map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : [content];
}
