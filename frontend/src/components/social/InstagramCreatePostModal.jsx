import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { publishInstagramPost, uploadSocialPublicMediaFile } from "../../services/socialApi";

const CAPTION_MAX = 2200;

const MEDIA_TYPES = [
  { value: "IMAGE", label: "Image" },
  { value: "VIDEO", label: "Video (feed)" },
  { value: "REEL", label: "Reel" },
  { value: "CAROUSEL", label: "Carousel" },
];

function initialFieldErrors() {
  return { caption: "", media: "", mediaType: "", general: "" };
}

export default function InstagramCreatePostModal({ open, onClose, onPublishSuccess }) {
  const { setToast, refreshConnectedAccounts } = useApp();
  const [caption, setCaption] = useState("");
  const [mediaType, setMediaType] = useState("IMAGE");
  const [mediaSource, setMediaSource] = useState("file");
  const [singleFile, setSingleFile] = useState(null);
  const [carouselFiles, setCarouselFiles] = useState([]);
  const [mediaUrl, setMediaUrl] = useState("");
  const [carouselUrlsText, setCarouselUrlsText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState(initialFieldErrors);

  useEffect(() => {
    if (!open) return;
    setCaption("");
    setMediaType("IMAGE");
    setMediaSource("file");
    setSingleFile(null);
    setCarouselFiles([]);
    setMediaUrl("");
    setCarouselUrlsText("");
    setFieldErrors(initialFieldErrors());
    setSubmitting(false);
  }, [open]);

  const [singleBlobUrl, setSingleBlobUrl] = useState(null);
  useEffect(() => {
    if (!singleFile) {
      setSingleBlobUrl(null);
      return undefined;
    }
    const u = URL.createObjectURL(singleFile);
    setSingleBlobUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [singleFile]);

  const [carouselBlobUrls, setCarouselBlobUrls] = useState([]);
  useEffect(() => {
    if (mediaType !== "CAROUSEL" || mediaSource !== "file") {
      setCarouselBlobUrls([]);
      return undefined;
    }
    const urls = carouselFiles.map((f) => ({ url: URL.createObjectURL(f), mime: f.type }));
    setCarouselBlobUrls(urls);
    return () => urls.forEach((item) => URL.revokeObjectURL(item.url));
  }, [mediaType, mediaSource, carouselFiles]);

  const carouselUrlPreview = useMemo(() => {
    if (mediaType !== "CAROUSEL" || mediaSource !== "url") return [];
    return carouselUrlsText
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((url) => ({ url, mime: "" }));
  }, [mediaType, mediaSource, carouselUrlsText]);

  const validate = () => {
    const next = initialFieldErrors();
    let ok = true;

    if (caption.length > CAPTION_MAX) {
      next.caption = `Caption must be at most ${CAPTION_MAX} characters.`;
      ok = false;
    } else if (caption.trim().length > 0 && !caption.trim().replace(/\s/g, "").length) {
      next.caption = "Caption cannot be only spaces.";
      ok = false;
    }

    if (!MEDIA_TYPES.some((m) => m.value === mediaType)) {
      next.mediaType = "Select a supported media type.";
      ok = false;
    }

    if (mediaType === "CAROUSEL") {
      if (mediaSource === "file") {
        if (carouselFiles.length < 2) {
          next.media = "Carousel requires at least two media files.";
          ok = false;
        } else if (carouselFiles.length > 10) {
          next.media = "Carousel supports at most 10 items.";
          ok = false;
        }
      } else {
        const lines = carouselUrlsText
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (lines.length < 2) {
          next.media = "Carousel requires at least two public media URLs (one per line or comma-separated).";
          ok = false;
        } else if (lines.length > 10) {
          next.media = "Carousel supports at most 10 URLs.";
          ok = false;
        } else {
          for (const line of lines) {
            try {
              const u = new URL(line);
              if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error();
            } catch {
              next.media = "Each carousel URL must be a valid http(s) link.";
              ok = false;
              break;
            }
          }
        }
      }
    } else {
      if (mediaSource === "file") {
        if (!singleFile) {
          next.media = "Media file is required.";
          ok = false;
        } else if (mediaType === "IMAGE" && !singleFile.type.startsWith("image/")) {
          next.media = "For image posts, choose an image file.";
          ok = false;
        } else if ((mediaType === "VIDEO" || mediaType === "REEL") && !singleFile.type.startsWith("video/")) {
          next.media = "For video or reel posts, choose a video file.";
          ok = false;
        }
      } else {
        const u = mediaUrl.trim();
        if (!u) {
          next.media = "Media URL is required.";
          ok = false;
        } else {
          try {
            const parsed = new URL(u);
            if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error();
          } catch {
            next.media = "Enter a valid http(s) URL that Instagram can fetch publicly.";
            ok = false;
          }
        }
      }
    }

    setFieldErrors(next);
    return ok;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setFieldErrors(initialFieldErrors());

    try {
      let payload;
      if (mediaType === "CAROUSEL") {
        let mediaUrls;
        if (mediaSource === "file") {
          mediaUrls = [];
          for (const f of carouselFiles) {
            const url = await uploadSocialPublicMediaFile(f);
            if (!url) throw new Error("Upload did not return a URL.");
            mediaUrls.push(url);
          }
        } else {
          mediaUrls = carouselUrlsText
            .split(/[\n,]/)
            .map((s) => s.trim())
            .filter(Boolean);
        }
        payload = {
          mediaType: "CAROUSEL",
          mediaUrls,
          caption: caption.trim() || undefined,
        };
      } else if (mediaSource === "file") {
        const url = await uploadSocialPublicMediaFile(singleFile);
        if (!url) throw new Error("Upload did not return a URL.");
        payload = {
          mediaType,
          mediaUrl: url,
          caption: caption.trim() || undefined,
        };
      } else {
        payload = {
          mediaType,
          mediaUrl: mediaUrl.trim(),
          caption: caption.trim() || undefined,
        };
      }

      const result = await publishInstagramPost(payload);
      if (!result?.success) {
        throw new Error(result?.message || "Instagram publishing failed.");
      }
      setToast({ message: result.message || "Post published successfully on Instagram." });
      onPublishSuccess?.();
      try {
        await refreshConnectedAccounts();
      } catch {
        /* non-fatal */
      }
      onClose?.();
    } catch (err) {
      setToast({ message: err.message || "Could not publish to Instagram.", error: true });
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Close dialog"
        onClick={() => !submitting && onClose?.()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="instagram-create-post-title"
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-600 bg-slate-900 p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="instagram-create-post-title" className="text-lg font-semibold text-white">
            Create Instagram post
          </h2>
          <button
            type="button"
            disabled={submitting}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-40"
            onClick={() => onClose?.()}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <p className="mb-4 text-xs text-slate-400">
          Media is required. Instagram fetches your file from a public URL—uploads use your app server. JPEG images are recommended for best compatibility.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {fieldErrors.general ? <p className="text-sm text-red-400">{fieldErrors.general}</p> : null}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Caption (optional)</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={CAPTION_MAX}
              rows={4}
              disabled={submitting}
              className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500"
              placeholder="Write a caption…"
            />
            <div className="mt-1 flex justify-between text-[11px] text-slate-500">
              <span>{fieldErrors.caption ? <span className="text-red-400">{fieldErrors.caption}</span> : " "}</span>
              <span>
                {caption.length} / {CAPTION_MAX}
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Media type</label>
            <select
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value)}
              disabled={submitting}
              className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500"
            >
              {MEDIA_TYPES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            {fieldErrors.mediaType ? <p className="mt-1 text-xs text-red-400">{fieldErrors.mediaType}</p> : null}
          </div>

          {mediaType === "CAROUSEL" ? null : (
            <div className="flex gap-3 text-xs">
              <label className="flex cursor-pointer items-center gap-2 text-slate-300">
                <input
                  type="radio"
                  name="ig-src"
                  checked={mediaSource === "file"}
                  onChange={() => setMediaSource("file")}
                  disabled={submitting}
                />
                Upload file
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-slate-300">
                <input
                  type="radio"
                  name="ig-src"
                  checked={mediaSource === "url"}
                  onChange={() => setMediaSource("url")}
                  disabled={submitting}
                />
                Media URL
              </label>
            </div>
          )}

          {mediaType === "CAROUSEL" ? (
            <div className="space-y-3">
              <div className="flex gap-3 text-xs">
                <label className="flex cursor-pointer items-center gap-2 text-slate-300">
                  <input
                    type="radio"
                    name="ig-carousel-src"
                    checked={mediaSource === "file"}
                    onChange={() => setMediaSource("file")}
                    disabled={submitting}
                  />
                  Upload files (2–10)
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-slate-300">
                  <input
                    type="radio"
                    name="ig-carousel-src"
                    checked={mediaSource === "url"}
                    onChange={() => setMediaSource("url")}
                    disabled={submitting}
                  />
                  Public URLs
                </label>
              </div>
              {mediaSource === "file" ? (
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  disabled={submitting}
                  onChange={(e) => setCarouselFiles(Array.from(e.target.files || []))}
                  className="block w-full text-xs text-slate-300"
                />
              ) : (
                <textarea
                  value={carouselUrlsText}
                  onChange={(e) => setCarouselUrlsText(e.target.value)}
                  disabled={submitting}
                  rows={5}
                  placeholder="One URL per line (or comma-separated), 2–10 items"
                  className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500"
                />
              )}
              {fieldErrors.media ? <p className="text-xs text-red-400">{fieldErrors.media}</p> : null}
              {(mediaSource === "file" ? carouselBlobUrls : carouselUrlPreview).length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {(mediaSource === "file" ? carouselBlobUrls : carouselUrlPreview).map((item) => (
                    <div key={item.url} className="aspect-square overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
                      {item.mime.startsWith("video/") || /\.(mp4|mov|webm)(\?|$)/i.test(item.url) ? (
                        <video src={item.url} className="h-full w-full object-cover" muted playsInline />
                      ) : (
                        <img src={item.url} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : mediaSource === "file" ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Media file</label>
              <input
                type="file"
                accept={mediaType === "IMAGE" ? "image/*" : "video/*"}
                disabled={submitting}
                onChange={(e) => setSingleFile(e.target.files?.[0] ?? null)}
                className="block w-full text-xs text-slate-300"
              />
              {fieldErrors.media ? <p className="mt-1 text-xs text-red-400">{fieldErrors.media}</p> : null}
              {singleBlobUrl && singleFile ? (
                <div className="mt-3 overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
                  {singleFile.type.startsWith("video/") || mediaType === "VIDEO" || mediaType === "REEL" ? (
                    <video src={singleBlobUrl} className="max-h-64 w-full object-contain" controls muted playsInline />
                  ) : (
                    <img src={singleBlobUrl} alt="" className="max-h-64 w-full object-contain" />
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Public media URL</label>
              <input
                type="url"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                disabled={submitting}
                placeholder="https://…"
                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500"
              />
              {fieldErrors.media ? <p className="mt-1 text-xs text-red-400">{fieldErrors.media}</p> : null}
              {mediaUrl.trim() ? (
                <div className="mt-3 overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
                  {mediaType === "VIDEO" || mediaType === "REEL" ? (
                    <video src={mediaUrl.trim()} className="max-h-64 w-full object-contain" controls muted playsInline />
                  ) : (
                    <img src={mediaUrl.trim()} alt="" className="max-h-64 w-full object-contain" />
                  )}
                </div>
              ) : null}
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => onClose?.()}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Publishing…" : "Publish to Instagram"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
