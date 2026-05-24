import { useEffect, useRef, useState } from "react";
import { fetchLinkPreviewImages } from "../services/linkPreviewApi";
import { extractFirstUrl } from "../utils/extractFirstUrl";

const DEBOUNCE_MS = 800;
const previewCache = new Map();

/**
 * Detects the first URL in post content and fetches suggested images (debounced, cached).
 */
export function useUrlMediaSuggestions(content) {
  const [detectedUrl, setDetectedUrl] = useState(null);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const url = extractFirstUrl(content);
    setDetectedUrl(url);

    if (!url) {
      setImages([]);
      setError("");
      setLoading(false);
      return undefined;
    }

    if (dismissed) {
      return undefined;
    }

    const cached = previewCache.get(url);
    if (cached) {
      setImages(cached.images);
      setError(cached.error || "");
      setLoading(false);
      return undefined;
    }

    const timer = setTimeout(async () => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      setError("");

      const result = await fetchLinkPreviewImages(url);
      if (requestId !== requestIdRef.current) return;

      previewCache.set(url, {
        images: result.images,
        error: result.success ? "" : result.error || "No images found for this link.",
      });

      setImages(result.images);
      if (!result.images.length) {
        setError(result.error || "No images found for this link.");
      } else {
        setError("");
      }
      setLoading(false);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [content, dismissed]);

  useEffect(() => {
    setDismissed(false);
  }, [detectedUrl]);

  const dismiss = () => setDismissed(true);

  const visible = Boolean(detectedUrl && !dismissed);

  return {
    detectedUrl,
    images,
    loading,
    error,
    visible,
    dismiss,
  };
}
