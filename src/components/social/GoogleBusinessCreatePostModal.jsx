import { useEffect, useMemo, useRef, useState } from "react";
import { X as CloseIcon } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { postToGoogleBusiness, uploadSocialPublicMediaFile } from "../../services/socialApi";

const SUMMARY_MAX = 1500;
const LOC_SEP = "\x1e";

const POST_TYPES = [
  { value: "STANDARD", label: "Standard / What's new" },
  { value: "EVENT", label: "Event" },
  { value: "OFFER", label: "Offer" },
];

const CTA_TYPES = [
  { value: "", label: "None" },
  { value: "BOOK", label: "Book" },
  { value: "ORDER", label: "Order" },
  { value: "SHOP", label: "Shop" },
  { value: "LEARN_MORE", label: "Learn more" },
  { value: "SIGN_UP", label: "Sign up" },
  { value: "CALL", label: "Call" },
];

function isValidHttpUrl(value) {
  if (!value || typeof value !== "string") return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function parseLocationKey(key) {
  if (!key || typeof key !== "string") return { accountId: "", locationId: "" };
  const parts = key.split(LOC_SEP);
  return { accountId: parts[0] || "", locationId: parts[1] || "" };
}

function makeLocationKey(accountId, locationId) {
  return `${accountId}${LOC_SEP}${locationId}`;
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {object | null | undefined} props.account
 * @param {{ accountId: string, locationId: string } | null | undefined} props.preset
 * @param {() => void} [props.onPublishSuccess]
 */
export default function GoogleBusinessCreatePostModal({ open, onClose, account, preset, onPublishSuccess }) {
  const { setToast } = useApp();
  const [locationKey, setLocationKey] = useState("");
  const [postType, setPostType] = useState("STANDARD");
  const [summary, setSummary] = useState("");
  const [mediaSource, setMediaSource] = useState("none");
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaUrlInput, setMediaUrlInput] = useState("");
  const [ctaType, setCtaType] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [offerTitle, setOfferTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [redeemUrl, setRedeemUrl] = useState("");
  const [termsConditions, setTermsConditions] = useState("");
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [posting, setPosting] = useState(false);
  const prevOpen = useRef(false);
  const [fileInputKey, setFileInputKey] = useState(0);

  const locations = useMemo(() => {
    const entities = Array.isArray(account?.entities) ? account.entities : [];
    return entities
      .filter((e) => e.entityType === "location" && e.entityId)
      .map((loc) => {
        const managed = loc.metadata?.managedEntity || {};
        const accountId = String(managed.googleBusinessAccountId || loc.metadata?.googleBusinessAccountId || "").trim();
        const locationId = String(loc.entityId || "").trim();
        return {
          key: makeLocationKey(accountId, locationId),
          accountId,
          locationId,
          label: loc.accountName || loc.username || `Location ${locationId}`,
          sub: accountId ? `Account ${accountId}` : "",
        };
      })
      .filter((row) => row.accountId && row.locationId)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [account?.entities]);

  const hasLocations = locations.length > 0;

  useEffect(() => {
    if (open && !prevOpen.current) {
      const p = preset?.accountId && preset?.locationId ? preset : null;
      if (p && locations.some((l) => l.accountId === p.accountId && l.locationId === p.locationId)) {
        setLocationKey(makeLocationKey(p.accountId, p.locationId));
      } else if (locations.length === 1) {
        setLocationKey(locations[0].key);
      } else {
        setLocationKey("");
      }
      setPostType("STANDARD");
      setSummary("");
      setMediaSource("none");
      setMediaFile(null);
      setMediaUrlInput("");
      setCtaType("");
      setCtaUrl("");
      setEventTitle("");
      setOfferTitle("");
      setStartDate("");
      setEndDate("");
      setCouponCode("");
      setRedeemUrl("");
      setTermsConditions("");
      setErrors({});
      setSubmitError("");
      setFileInputKey((k) => k + 1);
    }
    prevOpen.current = open;
  }, [open, preset, locations]);

  const imagePreviewUrl = useMemo(() => {
    if (!mediaFile || !mediaFile.type.startsWith("image/")) return null;
    return URL.createObjectURL(mediaFile);
  }, [mediaFile]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  if (!open) return null;

  const trimmedSummary = summary.trim();

  const validate = () => {
    const next = {};
    if (!hasLocations) {
      next.location = "No Google Business Profile location connected. Please connect a location first.";
    } else if (!locationKey) {
      next.location = "Select a business location.";
    } else {
      const { accountId, locationId } = parseLocationKey(locationKey);
      if (
        !accountId ||
        !locationId ||
        !locations.some((l) => l.accountId === accountId && l.locationId === locationId)
      ) {
        next.location = "Selected location is not valid for this connection.";
      }
    }

    if (!POST_TYPES.some((p) => p.value === postType)) {
      next.postType = "Select a post type.";
    }

    if (postType === "STANDARD") {
      if (!trimmedSummary.replace(/\s/g, "").length) {
        next.summary = "Post content is required and cannot be only spaces.";
      }
    }

    if (postType === "EVENT") {
      if (!eventTitle.trim().replace(/\s/g, "").length) {
        next.eventTitle = "Event title is required.";
      }
      if (!startDate) next.startDate = "Start date is required.";
      if (!endDate) next.endDate = "End date is required.";
      if (startDate && endDate && startDate > endDate) {
        next.endDate = "End date cannot be before start date.";
      }
    }

    if (postType === "OFFER") {
      if (!offerTitle.trim().replace(/\s/g, "").length) {
        next.offerTitle = "Offer title is required.";
      }
      if (!startDate) next.startDate = "Start date is required.";
      if (!endDate) next.endDate = "End date is required.";
      if (startDate && endDate && startDate > endDate) {
        next.endDate = "End date cannot be before start date.";
      }
    }

    if (trimmedSummary.length > SUMMARY_MAX) {
      next.summary = `Content cannot exceed ${SUMMARY_MAX} characters.`;
    }

    if (mediaSource === "url") {
      const u = mediaUrlInput.trim();
      if (u && !isValidHttpUrl(u)) {
        next.mediaUrl = "Media URL must be a valid http(s) link.";
      }
    }
    if (mediaSource === "file" && mediaFile) {
      const mime = (mediaFile.type || "").toLowerCase();
      const ok = mime.startsWith("image/") || mime.startsWith("video/");
      if (!ok) {
        next.media = "Choose an image or video file.";
      }
    }

    if (ctaType) {
      if (ctaType !== "CALL") {
        const u = ctaUrl.trim();
        if (!u) {
          next.ctaUrl = "Call-to-action URL is required for this button type.";
        } else if (!isValidHttpUrl(u)) {
          next.ctaUrl = "Call-to-action URL must start with http:// or https://.";
        }
      }
    } else if (ctaUrl.trim()) {
      next.ctaUrl = "Remove the URL or select a call-to-action type.";
    }

    const ru = redeemUrl.trim();
    if (ru && !isValidHttpUrl(ru)) {
      next.redeemUrl = "Redeem URL must be a valid http(s) link.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submitDisabled =
    posting ||
    !hasLocations ||
    trimmedSummary.length > SUMMARY_MAX ||
    (postType === "STANDARD" && !trimmedSummary.replace(/\s/g, "").length) ||
    (postType === "EVENT" &&
      (!eventTitle.trim().replace(/\s/g, "").length || !startDate || !endDate || startDate > endDate)) ||
    (postType === "OFFER" &&
      (!offerTitle.trim().replace(/\s/g, "").length || !startDate || !endDate || startDate > endDate)) ||
    (Boolean(ctaType) && ctaType !== "CALL" && (!ctaUrl.trim() || !isValidHttpUrl(ctaUrl.trim()))) ||
    (mediaSource === "url" && mediaUrlInput.trim() && !isValidHttpUrl(mediaUrlInput.trim())) ||
    (mediaSource === "file" &&
      mediaFile &&
      !(String(mediaFile.type || "")
        .toLowerCase()
        .startsWith("image/") || String(mediaFile.type || "").toLowerCase().startsWith("video/"))) ||
    (postType === "OFFER" && redeemUrl.trim() && !isValidHttpUrl(redeemUrl.trim()));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");
    if (!validate()) return;

    const { accountId, locationId } = parseLocationKey(locationKey);

    let mediaUrl = "";
    setPosting(true);
    try {
      if (mediaSource === "file" && mediaFile) {
        mediaUrl = await uploadSocialPublicMediaFile(mediaFile);
        if (!mediaUrl) {
          throw new Error("Upload completed but no public URL was returned.");
        }
      } else if (mediaSource === "url") {
        mediaUrl = mediaUrlInput.trim();
      }

      await postToGoogleBusiness({
        locationId,
        accountId,
        postType,
        summary: trimmedSummary,
        mediaUrl,
        ctaType,
        ctaUrl: ctaType === "CALL" ? "" : ctaUrl.trim(),
        eventTitle: postType === "EVENT" ? eventTitle.trim() : "",
        offerTitle: postType === "OFFER" ? offerTitle.trim() : "",
        startDate: postType === "EVENT" || postType === "OFFER" ? startDate : "",
        endDate: postType === "EVENT" || postType === "OFFER" ? endDate : "",
        couponCode: postType === "OFFER" ? couponCode.trim() : "",
        redeemUrl: postType === "OFFER" ? redeemUrl.trim() : "",
        termsConditions: postType === "OFFER" ? termsConditions.trim() : "",
      });

      setToast({ message: "Post published successfully on Google Business Profile." });
      onPublishSuccess?.();
      setSummary("");
      setMediaSource("none");
      setMediaFile(null);
      setMediaUrlInput("");
      setCtaType("");
      setCtaUrl("");
      setEventTitle("");
      setOfferTitle("");
      setStartDate("");
      setEndDate("");
      setCouponCode("");
      setRedeemUrl("");
      setTermsConditions("");
      setErrors({});
      setFileInputKey((k) => k + 1);
      onClose();
    } catch (err) {
      const msg = err?.message || "Could not publish post on Google Business Profile.";
      const lower = msg.toLowerCase();
      if (
        lower.includes("reconnect") ||
        lower.includes("not connected") ||
        lower.includes("token expired") ||
        lower.includes("unauthorized") ||
        lower.includes("403")
      ) {
        setSubmitError(
          "Google Business Profile is not connected or token expired. Please reconnect your Google account."
        );
      } else {
        setSubmitError(msg);
      }
    } finally {
      setPosting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gb-create-post-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="absolute right-3 top-3 rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          onClick={onClose}
          disabled={posting}
          aria-label="Close"
        >
          <CloseIcon size={18} />
        </button>
        <h2 id="gb-create-post-title" className="pr-8 text-lg font-semibold text-white">
          Create post on Google Business Profile
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Local posts for Standard updates, events, and offers. Optional media is uploaded to your app&apos;s public URL first,
          then sent to Google. Summary up to {SUMMARY_MAX.toLocaleString()} characters for Standard posts.
        </p>

        <form className="mt-4 space-y-4" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="gb-location" className="mb-1 block text-xs font-medium text-slate-400">
              Business location
            </label>
            <select
              id="gb-location"
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-slate-100"
              value={locationKey}
              onChange={(e) => {
                setLocationKey(e.target.value);
                setErrors((prev) => {
                  const n = { ...prev };
                  delete n.location;
                  return n;
                });
              }}
              disabled={posting || !hasLocations}
            >
              <option value="">{hasLocations ? "Select location…" : "No locations available"}</option>
              {locations.map((loc) => (
                <option key={loc.key} value={loc.key}>
                  {loc.label} ({loc.locationId})
                </option>
              ))}
            </select>
            {errors.location ? (
              <p className="mt-1 text-xs text-rose-400" role="alert">
                {errors.location}
              </p>
            ) : null}
            {!hasLocations ? (
              <p className="mt-2 text-xs text-amber-200/90">
                No Google Business Profile location connected. Please connect a location first.
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="gb-post-type" className="mb-1 block text-xs font-medium text-slate-400">
              Post type
            </label>
            <select
              id="gb-post-type"
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-slate-100"
              value={postType}
              onChange={(e) => {
                setPostType(e.target.value);
                setErrors({});
                setSubmitError("");
              }}
              disabled={posting}
            >
              {POST_TYPES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            {errors.postType ? (
              <p className="mt-1 text-xs text-rose-400" role="alert">
                {errors.postType}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="gb-summary" className="mb-1 block text-xs font-medium text-slate-400">
              Post content / summary
              {postType === "STANDARD" ? <span className="text-rose-400"> *</span> : null}
            </label>
            <textarea
              id="gb-summary"
              rows={4}
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-slate-100 placeholder:text-slate-600"
              placeholder={
                postType === "STANDARD"
                  ? "What do you want customers to know?"
                  : "Optional summary text (recommended for context)"
              }
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              disabled={posting}
              maxLength={SUMMARY_MAX + 200}
            />
            <p className="mt-1 text-[11px] text-slate-500">
              {trimmedSummary.length}/{SUMMARY_MAX}
            </p>
            {errors.summary ? (
              <p className="mt-1 text-xs text-rose-400" role="alert">
                {errors.summary}
              </p>
            ) : null}
          </div>

          {(postType === "EVENT" || postType === "OFFER") && (
            <div className="grid gap-3 rounded-lg border border-slate-700 bg-slate-950/40 p-3 sm:grid-cols-2">
              {postType === "EVENT" ? (
                <div className="sm:col-span-2">
                  <label htmlFor="gb-event-title" className="mb-1 block text-xs font-medium text-slate-400">
                    Event title *
                  </label>
                  <input
                    id="gb-event-title"
                    type="text"
                    className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-slate-100"
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    disabled={posting}
                  />
                  {errors.eventTitle ? (
                    <p className="mt-1 text-xs text-rose-400" role="alert">
                      {errors.eventTitle}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="sm:col-span-2">
                  <label htmlFor="gb-offer-title" className="mb-1 block text-xs font-medium text-slate-400">
                    Offer title *
                  </label>
                  <input
                    id="gb-offer-title"
                    type="text"
                    className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-slate-100"
                    value={offerTitle}
                    onChange={(e) => setOfferTitle(e.target.value)}
                    disabled={posting}
                  />
                  {errors.offerTitle ? (
                    <p className="mt-1 text-xs text-rose-400" role="alert">
                      {errors.offerTitle}
                    </p>
                  ) : null}
                </div>
              )}
              <div>
                <label htmlFor="gb-start" className="mb-1 block text-xs font-medium text-slate-400">
                  Start date *
                </label>
                <input
                  id="gb-start"
                  type="date"
                  className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-slate-100"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={posting}
                />
                {errors.startDate ? (
                  <p className="mt-1 text-xs text-rose-400" role="alert">
                    {errors.startDate}
                  </p>
                ) : null}
              </div>
              <div>
                <label htmlFor="gb-end" className="mb-1 block text-xs font-medium text-slate-400">
                  End date *
                </label>
                <input
                  id="gb-end"
                  type="date"
                  className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-slate-100"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={posting}
                />
                {errors.endDate ? (
                  <p className="mt-1 text-xs text-rose-400" role="alert">
                    {errors.endDate}
                  </p>
                ) : null}
              </div>
              {postType === "OFFER" ? (
                <>
                  <div>
                    <label htmlFor="gb-coupon" className="mb-1 block text-xs font-medium text-slate-400">
                      Coupon code (optional)
                    </label>
                    <input
                      id="gb-coupon"
                      type="text"
                      className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-slate-100"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      disabled={posting}
                    />
                  </div>
                  <div>
                    <label htmlFor="gb-redeem" className="mb-1 block text-xs font-medium text-slate-400">
                      Redeem URL (optional)
                    </label>
                    <input
                      id="gb-redeem"
                      type="url"
                      className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-slate-100"
                      value={redeemUrl}
                      onChange={(e) => setRedeemUrl(e.target.value)}
                      disabled={posting}
                      placeholder="https://"
                    />
                    {errors.redeemUrl ? (
                      <p className="mt-1 text-xs text-rose-400" role="alert">
                        {errors.redeemUrl}
                      </p>
                    ) : null}
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="gb-terms" className="mb-1 block text-xs font-medium text-slate-400">
                      Terms (optional)
                    </label>
                    <textarea
                      id="gb-terms"
                      rows={2}
                      className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-slate-100"
                      value={termsConditions}
                      onChange={(e) => setTermsConditions(e.target.value)}
                      disabled={posting}
                    />
                  </div>
                </>
              ) : null}
            </div>
          )}

          <div>
            <span className="mb-1 block text-xs font-medium text-slate-400">Media (optional)</span>
            <div className="flex flex-wrap gap-3 text-sm text-slate-300">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="gb-media"
                  checked={mediaSource === "none"}
                  onChange={() => {
                    setMediaSource("none");
                    setMediaFile(null);
                    setMediaUrlInput("");
                    setFileInputKey((k) => k + 1);
                  }}
                  disabled={posting}
                />
                None
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="gb-media"
                  checked={mediaSource === "file"}
                  onChange={() => {
                    setMediaSource("file");
                    setMediaUrlInput("");
                  }}
                  disabled={posting}
                />
                Upload file
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="gb-media"
                  checked={mediaSource === "url"}
                  onChange={() => {
                    setMediaSource("url");
                    setMediaFile(null);
                    setFileInputKey((k) => k + 1);
                  }}
                  disabled={posting}
                />
                Media URL
              </label>
            </div>
            {mediaSource === "file" ? (
              <div className="mt-2">
                <input
                  key={fileInputKey}
                  type="file"
                  accept="image/*,video/*"
                  disabled={posting}
                  className="block w-full text-sm text-slate-200 file:mr-3 file:rounded-md file:border-0 file:bg-brand-500 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
                  onChange={(e) => setMediaFile(e.target.files?.[0] ?? null)}
                />
                {errors.media ? (
                  <p className="mt-1 text-xs text-rose-400" role="alert">
                    {errors.media}
                  </p>
                ) : null}
                {imagePreviewUrl ? (
                  <img src={imagePreviewUrl} alt="" className="mt-2 max-h-40 rounded-lg border border-slate-600 object-contain" />
                ) : null}
              </div>
            ) : null}
            {mediaSource === "url" ? (
              <div className="mt-2">
                <input
                  type="url"
                  className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-slate-100"
                  placeholder="https://example.com/image.jpg"
                  value={mediaUrlInput}
                  onChange={(e) => setMediaUrlInput(e.target.value)}
                  disabled={posting}
                />
                {errors.mediaUrl ? (
                  <p className="mt-1 text-xs text-rose-400" role="alert">
                    {errors.mediaUrl}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="gb-cta-type" className="mb-1 block text-xs font-medium text-slate-400">
                Call-to-action (optional)
              </label>
              <select
                id="gb-cta-type"
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-slate-100"
                value={ctaType}
                onChange={(e) => {
                  setCtaType(e.target.value);
                  if (e.target.value === "CALL") setCtaUrl("");
                }}
                disabled={posting}
              >
                {CTA_TYPES.map((c) => (
                  <option key={c.value || "none"} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="gb-cta-url" className="mb-1 block text-xs font-medium text-slate-400">
                CTA URL {ctaType && ctaType !== "CALL" ? "(required)" : "(optional)"}
              </label>
              <input
                id="gb-cta-url"
                type="url"
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-slate-100 disabled:opacity-50"
                placeholder="https://"
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                disabled={posting || !ctaType || ctaType === "CALL"}
              />
              {errors.ctaUrl ? (
                <p className="mt-1 text-xs text-rose-400" role="alert">
                  {errors.ctaUrl}
                </p>
              ) : null}
            </div>
          </div>

          {submitError ? (
            <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100" role="alert">
              {submitError}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-700 pt-4">
            <button
              type="button"
              className="rounded-md border border-slate-600 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
              onClick={onClose}
              disabled={posting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={submitDisabled}
            >
              {posting ? "Posting…" : "Publish post"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
