import { useMemo, useState } from "react";
import { Sparkles, LayoutTemplate, Wand2, Hash, Minimize2, MessageCircle, Loader2 } from "lucide-react";
import {
  POST_TEMPLATE_CATEGORIES,
  AI_TONE_OPTIONS,
  AI_GOAL_OPTIONS,
} from "../../data/postIdeasTemplates";
import { applyTemplate, getTemplatesForPlatform, improveCaption } from "../../utils/aiPostGenerator";
import { generateAiCaptions } from "../../services/aiApi";

export default function PostIdeasPanel({
  caption,
  onApplyCaption,
  selectedPlatform,
  topic: topicProp,
  onTopicChange,
  section = "both",
  embedded = false,
}) {
  const showTemplates = section === "both" || section === "templates";
  const showAi = section === "both" || section === "ai";
  const templatesOnlyEmbedded = embedded && showTemplates && !showAi;
  const [category, setCategory] = useState("all");
  const [topic, setTopic] = useState(topicProp || "");
  const [tone, setTone] = useState("casual");
  const [goal, setGoal] = useState("engage");
  const [generating, setGenerating] = useState(false);
  const [aiResults, setAiResults] = useState([]);
  const [lastSource, setLastSource] = useState("");

  const templates = useMemo(
    () => getTemplatesForPlatform(selectedPlatform, category),
    [selectedPlatform, category]
  );

  const handleTopicChange = (value) => {
    setTopic(value);
    onTopicChange?.(value);
  };

  const runGenerate = async () => {
    setGenerating(true);
    try {
      const results = await generateAiCaptions({
        topic,
        tone,
        goal,
        platform: selectedPlatform,
      });
      setAiResults(results);
      setLastSource(results[0]?.source || "local");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <article
      className={`overflow-hidden bg-white dark:bg-slate-900 ${
        embedded
          ? "flex min-h-0 flex-1 flex-col rounded-xl border border-slate-200 shadow-sm dark:border-slate-700"
          : "rounded-2xl border-2 border-slate-200 shadow-sm dark:border-slate-700"
      }`}
    >
      {!embedded ? (
        <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-950/40">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <Sparkles size={16} className="text-buffer-600 dark:text-buffer-400" />
            Ideas & AI
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">Templates and AI assistant — pick either side to fill your post</p>
        </div>
      ) : null}

      <div
        className={`grid ${
          templatesOnlyEmbedded ? "min-h-0 flex-1" : "min-h-[320px]"
        } ${
          showTemplates && showAi
            ? "lg:grid-cols-2 lg:divide-x lg:divide-slate-200 dark:lg:divide-slate-700"
            : "grid-cols-1"
        }`}
      >
        {showTemplates ? (
        <section className={`flex flex-col ${templatesOnlyEmbedded ? "min-h-0 flex-1" : "min-h-[280px]"}`}>
          <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-950/30">
            <LayoutTemplate size={15} className="text-buffer-600 dark:text-buffer-400" />
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              Templates
            </span>
          </div>
          <div className="flex flex-1 flex-col overflow-hidden p-4">
            {!templatesOnlyEmbedded ? (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {POST_TEMPLATE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                      category === cat.id
                        ? "bg-buffer-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {templates.length === 0 ? (
                <p className="text-xs text-slate-500">No templates for this filter. Try &quot;All&quot;.</p>
              ) : (
                templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => onApplyCaption(applyTemplate(tpl, { topic }))}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-left transition hover:border-buffer-300 hover:bg-buffer-50/50 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-buffer-500/40"
                  >
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{tpl.title}</p>
                    <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{tpl.caption.split("\n")[0]}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </section>
        ) : null}

        {showAi ? (
        <section className="flex min-h-[280px] flex-col">
          <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-950/30">
            <Wand2 size={15} className="text-buffer-600 dark:text-buffer-400" />
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              AI assistant
            </span>
          </div>
          <div className="flex flex-1 flex-col overflow-y-auto p-4">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Topic / product</span>
              <input
                value={topic}
                onChange={(e) => handleTopicChange(e.target.value)}
                placeholder="e.g. spring sale, new feature"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-buffer-500 focus:ring-2 focus:ring-buffer-500/20 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Tone</span>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                >
                  {AI_TONE_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Goal</span>
                <select
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                >
                  {AI_GOAL_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="button"
              disabled={generating}
              onClick={runGenerate}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-buffer-600 py-2.5 text-sm font-semibold text-white hover:bg-buffer-700 disabled:opacity-60"
            >
              {generating ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
              {generating ? "Generating…" : "Generate captions"}
            </button>
            {lastSource ? (
              <p className="mt-2 text-center text-[10px] text-slate-400">
                {lastSource === "openai" ? "Powered by OpenAI" : "Smart suggestions (add OPENAI_API_KEY for GPT)"}
              </p>
            ) : null}
            {aiResults.length > 0 ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Pick a variant</p>
                {aiResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onApplyCaption(item.caption)}
                    className="w-full rounded-lg border border-slate-200 p-3 text-left text-xs text-slate-700 transition hover:border-buffer-400 dark:border-slate-700 dark:text-slate-200"
                  >
                    <p className="line-clamp-4 whitespace-pre-wrap">{item.caption}</p>
                  </button>
                ))}
              </div>
            ) : null}
            {caption.trim() ? (
              <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-800">
                <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">Improve current caption</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: "hashtags", label: "Hashtags", icon: Hash },
                    { id: "shorten", label: "Shorter", icon: Minimize2 },
                    { id: "cta", label: "Add CTA", icon: MessageCircle },
                  ].map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onApplyCaption(improveCaption(caption, id))}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                    >
                      <Icon size={12} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
        ) : null}
      </div>
    </article>
  );
}
