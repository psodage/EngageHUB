/**
 * Providers sometimes append junk URL fragments after OAuth (e.g. #_ or legacy #_=_).
 * Strip them so the SPA URL is clean; query params are unchanged.
 */
export function stripOAuthRedirectFragment() {
  const hash = window.location.hash;
  if (!hash || hash === "#") return;
  if (hash === "#_=_" || hash === "#_" || /^#_+/.test(hash)) {
    window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}`);
  }
}
