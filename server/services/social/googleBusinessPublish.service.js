import axios from "axios";

const MYBUSINESS_V4 = "https://mybusiness.googleapis.com/v4";

function summarizeAxiosError(error) {
  return {
    message: error?.message || "Google Business Profile request failed",
    status: error?.response?.status || null,
    data: error?.response?.data || null,
  };
}

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
 * @param {object} opts
 * @param {string} opts.accessToken
 * @param {string} opts.accountId  Numeric Google Business account id (accounts/{accountId})
 * @param {string} opts.locationId Location id segment (locations/{locationId})
 * @param {object} opts.parsed Output of controller validation
 */
export async function publishGoogleBusinessLocalPost({ accessToken, accountId, locationId, parsed }) {
  const url = `${MYBUSINESS_V4}/accounts/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(locationId)}/localPosts`;

  /** @type {Record<string, unknown>} */
  const body = {
    languageCode: "en-US",
    summary: parsed.summary,
    topicType: parsed.postType,
  };

  if (parsed.ctaType) {
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
        endDate: parsed.endDateParts,
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

  try {
    const response = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      validateStatus: () => true,
    });

    if (response.status >= 200 && response.status < 300) {
      const data = response.data || {};
      const name = typeof data.name === "string" ? data.name : "";
      const postId = name.includes("/localPosts/")
        ? name.split("/localPosts/")[1] || name
        : name || (data.id ? String(data.id) : "");
      return { postId: postId || String(response.status), raw: data };
    }

    const err = new Error(
      response.data?.error?.message ||
        response.data?.error_message ||
        `Google Business Profile API error (${response.status}).`
    );
    err.status = response.status || 502;
    err.code = "google_business_post_failed";
    err.details = response.data;
    throw err;
  } catch (error) {
    if (error?.code === "google_business_post_failed") throw error;
    const summary = summarizeAxiosError(error);
    console.error("[googleBusiness:publish:error]", summary);
    const err = new Error(summary.message || "Could not publish Google Business Profile post.");
    err.status = summary.status && summary.status >= 400 && summary.status < 600 ? summary.status : 502;
    err.code = "google_business_post_failed";
    err.details = summary.data;
    throw err;
  }
}
