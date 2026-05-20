import { useState } from "react";
import { motion } from "framer-motion";
import { Send } from "lucide-react";
import { createGitHubActivityCard } from "../../services/githubApi";

export default function GitHubActivityCardComposer({ defaultLinkUrl = "", onSuccess, setToast }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState(defaultLinkUrl);
  const [repoName, setRepoName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() && !body.trim()) {
      setToast?.({ message: "Add a title or description for the activity card.", error: true });
      return;
    }
    setSubmitting(true);
    try {
      await createGitHubActivityCard({
        title: title.trim(),
        body: body.trim(),
        linkUrl: linkUrl.trim(),
        repoName: repoName.trim(),
        activityType: "manual_card",
      });
      setToast?.({ message: "Activity card saved — ready for cross-platform scheduling." });
      setTitle("");
      setBody("");
      setRepoName("");
      onSuccess?.();
    } catch (err) {
      setToast?.({ message: err.message || "Could not save activity card.", error: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <h4 className="text-sm font-semibold text-white">Share activity card</h4>
      <p className="mt-1 text-xs text-slate-400">Save dev updates for scheduling to LinkedIn, X, and other channels.</p>
      <motion.div className="mt-4 space-y-3" layout>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (e.g. Shipped v2.0)"
          className="w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-violet-500/60 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What changed?"
          rows={3}
          className="w-full resize-none rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-violet-500/60 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            value={repoName}
            onChange={(e) => setRepoName(e.target.value)}
            placeholder="Repository (optional)"
            className="w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-violet-500/60 focus:outline-none"
          />
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="Link URL"
            className="w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-violet-500/60 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50"
        >
          <Send size={16} />
          {submitting ? "Saving…" : "Save activity card"}
        </button>
      </motion.div>
    </motion.form>
  );
}
