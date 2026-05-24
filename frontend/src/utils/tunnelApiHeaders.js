const NGROK_HOST_RE = /\.ngrok-free\.(dev|app)$/i;

/**
 * Ngrok free tier requires this header on HTTP requests (fetch/axios) to the ngrok URL
 * so JSON/API responses are returned instead of the HTML warning document.
 */
export function isNgrokHttpUrl(urlString) {
  if (!urlString || typeof urlString !== "string") return false;
  try {
    const { hostname } = new URL(urlString);
    return (
      NGROK_HOST_RE.test(hostname) ||
      /\.ngrok\.(io|app)$/i.test(hostname)
    );
  } catch {
    return false;
  }
}

export function ngrokSkipBrowserWarningHeader() {
  return { "ngrok-skip-browser-warning": "69420" };
}
