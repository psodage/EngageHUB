/** Default times for GBP local post event schedules (API requires all TimeInterval fields). */
export const DEFAULT_EVENT_START_TIME = { hours: 9, minutes: 0, seconds: 0, nanos: 0 };
export const DEFAULT_EVENT_END_TIME = { hours: 17, minutes: 0, seconds: 0, nanos: 0 };

function inferMediaFormat(mediaUrl) {
  if (!mediaUrl || typeof mediaUrl !== "string") return "PHOTO";
  const lower = mediaUrl.split("?")[0].toLowerCase();
  if (
    lower.endsWith(".mp4") ||
    lower.endsWith(".mov") ||
    lower.endsWith(".webm") ||
    lower.endsWith(".m4v")
  ) {
    return "VIDEO";
  }
  return "PHOTO";
}

/**
 * Build the JSON body for My Business API v4 localPosts.create.
 * @param {object} parsed Output of parseGoogleBusinessPostBody (controller)
 * @returns {{ urlPath: string, body: Record<string, unknown> }}
 */
export function buildGoogleBusinessLocalPostRequest({ accountId, locationId, parsed }) {
  const urlPath = `/accounts/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(locationId)}/localPosts`;

  /** @type {Record<string, unknown>} */
  const body = {
    languageCode: "en-US",
    summary: parsed.summary,
    topicType: parsed.postType,
  };

  if (parsed.ctaType && parsed.postType !== "OFFER") {
    body.callToAction = { actionType: parsed.ctaType };
    if (parsed.ctaType !== "CALL" && parsed.ctaUrl) {
      body.callToAction.url = parsed.ctaUrl;
    }
  }

  if (parsed.mediaUrl) {
    body.media = [
      {
        mediaFormat: parsed.mediaFormat || inferMediaFormat(parsed.mediaUrl),
        sourceUrl: parsed.mediaUrl,
      },
    ];
  }

  if (parsed.postType === "EVENT" || parsed.postType === "OFFER") {
    body.event = {
      title: parsed.postType === "EVENT" ? parsed.eventTitle : parsed.offerTitle,
      schedule: {
        startDate: parsed.startDateParts,
        startTime: DEFAULT_EVENT_START_TIME,
        endDate: parsed.endDateParts,
        endTime: DEFAULT_EVENT_END_TIME,
      },
    };
  }

  if (parsed.postType === "OFFER") {
    body.offer = {};
    if (parsed.couponCode) body.offer.couponCode = parsed.couponCode;
    if (parsed.redeemUrl) body.offer.redeemOnlineUrl = parsed.redeemUrl;
    if (parsed.termsConditions) body.offer.termsConditions = parsed.termsConditions;
    if (!Object.keys(body.offer).length) {
      delete body.offer;
    }
  }

  return { urlPath, body };
}
