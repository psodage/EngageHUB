import { resolveFacebookPageCreatePostPath } from "./createPostChannels";

/** @typedef {'profile' | 'page' | 'organization' | 'channel' | 'account'} PostingTargetBadge */

/**
 * @typedef {object} PostingTargetCard
 * @property {string} key
 * @property {PostingTargetBadge} badge
 * @property {string} title
 * @property {string} sublabel
 * @property {string} imageUrl
 * @property {string} path
 * @property {{ targetType: 'profile' | 'organization', organizationId: string | null } | null} [linkedinAction]
 * @property {{ accountId: string, locationId: string } | null} [googleBusinessPreset]
 * @property {string} [telegramChatId]
 * @property {{ guildId: string, channelId: string } | null} [discordPreset]
 */

/**
 * @typedef {object} PostingTargetsConfig
 * @property {string} title
 * @property {string} description
 * @property {string} [primaryCtaLabel]
 * @property {string} [primaryCtaPath]
 * @property {PostingTargetCard[]} cards
 * @property {{ tone: 'neutral' | 'amber', text: string } | null} [emptyBanner]
 */

function entityDisplayName(entity) {
  return entity?.accountName || entity?.name || entity?.username || "Untitled";
}

function placeholderImage(platformKey) {
  const abbrev =
    {
      instagram: "IG",
      threads: "TH",
      youtube: "YT",
      x: "X",
      reddit: "RD",
      pinterest: "PI",
      telegram: "TG",
      discord: "DC",
      googleBusiness: "GB",
      facebook: "FB",
      linkedin: "LI",
    }[platformKey] || "PO";
  return `https://placehold.co/96x96/0f172a/94a3b8?text=${encodeURIComponent(abbrev)}`;
}

/**
 * @param {string} platformKey
 * @param {object | null | undefined} account Grouped social account from API (`entities`, `metadata`, …).
 * @returns {PostingTargetsConfig | null}
 */
export function buildPostingTargetsConfig(platformKey, account) {
  if (!account?.isConnected) return null;

  const entities = Array.isArray(account.entities) ? account.entities : [];

  const primaryRow = () => ({
    entityId: account.entityId || account.platformUserId,
    accountName: account.accountName,
    username: account.username,
    profileImage: account.profileImage,
  });

  if (platformKey === "facebook") {
    const pageRows = entities
      .filter((e) => e.entityType === "page" && e.isConnected !== false)
      .sort((a, b) => entityDisplayName(a).localeCompare(entityDisplayName(b)));

    /** @type {PostingTargetCard[]} */
    const cards = [];
    for (const page of pageRows) {
      const pageId = String(page.entityId || page.platformUserId || "").trim();
      const entityQs = pageId ? `?entity=${encodeURIComponent(pageId)}` : "";
      cards.push({
        key: `page-${pageId}`,
        badge: "page",
        title: entityDisplayName(page),
        sublabel: pageId ? `Facebook Page · ID ${pageId}` : "Facebook Page",
        imageUrl: page.profileImage || placeholderImage("facebook"),
        path: `/channels/facebook${entityQs}`,
      });
    }
    if (!cards.length) {
      const row = primaryRow();
      const pid = row.entityId || account.platformUserId || "";
      const entityQs = pid ? `?entity=${encodeURIComponent(pid)}` : "";
      cards.push({
        key: `fallback-${pid}`,
        badge: "page",
        title: row.accountName || row.username || "Facebook",
        sublabel: pid ? `ID ${pid}` : "Facebook",
        imageUrl: row.profileImage || placeholderImage("facebook"),
        path: `/channels/facebook${entityQs}`,
      });
    }

    const primaryCreatePath = resolveFacebookPageCreatePostPath(account);

    return {
      title: "Facebook Pages",
      description: "Publish to Facebook Pages you manage. Connect at least one Page under Channels.",
      primaryCtaLabel: pageRows.length ? "Create post" : "Connect a Facebook Page",
      primaryCtaPath: primaryCreatePath,
      cards: cards.map((card) => {
        const match = card.key.match(/^page-(.+)$/);
        const entityId = match?.[1] ? decodeURIComponent(match[1]) : "";
        if (!entityId) return card;
        return {
          ...card,
          path: `/create-post?platform=facebook&entity=${encodeURIComponent(entityId)}`,
        };
      }),
      emptyBanner: pageRows.length
        ? null
        : {
            tone: "amber",
            text: "Connect at least one Facebook Page to publish from EngageHub.",
          },
    };
  }

  if (platformKey === "linkedin") {
    const profileRow =
      entities.find((e) => e.entityType === "profile") ||
      entities.find((e) => e.isPrimary && e.entityType !== "organization") ||
      null;
    const orgRows = entities
      .filter((e) => e.entityType === "organization")
      .sort((a, b) => entityDisplayName(a).localeCompare(entityDisplayName(b)));

    /** @type {PostingTargetCard[]} */
    const cards = [];
    if (profileRow) {
      cards.push({
        key: `profile-${profileRow.entityId || account.platformUserId}`,
        badge: "profile",
        title: entityDisplayName(profileRow),
        sublabel: "Personal profile",
        imageUrl: profileRow.profileImage || placeholderImage("linkedin"),
        path: "/create-post?platform=linkedin",
        linkedinAction: { targetType: "profile", organizationId: null },
      });
    } else {
      const row = { ...primaryRow(), entityType: "profile" };
      cards.push({
        key: `profile-fallback-${account.platformUserId}`,
        badge: "profile",
        title: entityDisplayName(row),
        sublabel: "Personal profile",
        imageUrl: row.profileImage || placeholderImage("linkedin"),
        path: "/create-post?platform=linkedin",
        linkedinAction: { targetType: "profile", organizationId: null },
      });
    }
    for (const org of orgRows) {
      cards.push({
        key: `org-${org.entityId}`,
        badge: "organization",
        title: entityDisplayName(org),
        sublabel: org.entityId ? `Company page · ID ${org.entityId}` : "Company page",
        imageUrl: org.profileImage || placeholderImage("linkedin"),
        path: `/create-post?platform=linkedin&entityId=${encodeURIComponent(org.entityId)}`,
        linkedinAction: { targetType: "organization", organizationId: org.entityId ? String(org.entityId) : null },
      });
    }

    const linkedInOrgDiscoveryCode = account.metadata?.organizationDiscoveryErrorCode;
    const emptyBanner =
      orgRows.length === 0
        ? {
            tone:
              linkedInOrgDiscoveryCode === "linkedin_orgs_forbidden" || linkedInOrgDiscoveryCode === "linkedin_orgs_failed"
                ? "amber"
                : "neutral",
            text:
              linkedInOrgDiscoveryCode === "linkedin_orgs_forbidden"
                ? "LinkedIn did not return company pages for this token (often missing Community Management / organization APIs on your app, or the member is not an approved admin). Your personal profile card above still works; update the LinkedIn developer app products and scopes, then reconnect."
                : linkedInOrgDiscoveryCode === "linkedin_orgs_failed"
                  ? "Company pages could not be loaded from LinkedIn (temporary or configuration issue). Your personal profile card above still works; try reconnecting."
                  : "No company pages were returned for this login. Ensure your LinkedIn app has organization scopes and that your member is an admin of the page, then reconnect.",
          }
        : null;

    return {
      title: "Available pages",
      description:
        "Post as your personal profile or as a company page. Choose a card to open the composer with the right target.",
      primaryCtaLabel: "Create post (profile)",
      primaryCtaPath: "/create-post?platform=linkedin",
      cards,
      emptyBanner,
    };
  }

  /** Single-target platforms: one card from the primary connection. */
  const single = (title, description, sublabel, badge) => {
    const row = entities[0] || primaryRow();
    return {
      title,
      description,
      primaryCtaLabel: "Create post",
      primaryCtaPath: `/create-post?platform=${platformKey}`,
      cards: [
        {
          key: `target-${row.entityId || account.platformUserId}`,
          badge,
          title: entityDisplayName(row),
          sublabel,
          imageUrl: row.profileImage || placeholderImage(platformKey),
          path: `/create-post?platform=${platformKey}`,
        },
      ],
      emptyBanner: null,
    };
  };

  if (platformKey === "instagram") {
    const at = account.metadata?.accountType;
    return single(
      "Available posting targets",
      "Your connected Instagram account used as the publishing target.",
      at ? `Professional account · ${at}` : "Instagram professional / creator account",
      "account"
    );
  }

  if (platformKey === "threads") {
    return single(
      "Available posting targets",
      "Your connected Threads profile for publishing.",
      "Threads profile",
      "profile"
    );
  }

  if (platformKey === "youtube") {
    return single(
      "Available posting targets",
      "Your connected YouTube channel for uploads and publishing.",
      "YouTube channel",
      "channel"
    );
  }

  if (platformKey === "x") {
    return single("Available posting targets", "Your connected X profile for posting.", "X profile", "profile");
  }

  if (platformKey === "reddit") {
    return single(
      "Available posting targets",
      "Your connected Reddit account. Choose subreddit or post options in the composer when supported.",
      "Reddit account",
      "account"
    );
  }

  if (platformKey === "pinterest") {
    return single(
      "Available posting targets",
      "Your connected Pinterest account. Boards and pins can be chosen in the composer when supported.",
      "Pinterest account",
      "account"
    );
  }

  if (platformKey === "telegram") {
    const targets = Array.isArray(account.metadata?.telegramTargets) ? account.metadata.telegramTargets : [];
    /** @type {PostingTargetCard[]} */
    const cards = targets
      .filter((t) => t && t.chatId)
      .map((t) => ({
        key: `tg-${String(t.chatId)}`,
        badge: t.chatType === "channel" ? "channel" : "account",
        title: t.chatTitle || String(t.chatId),
        sublabel: `${t.chatType === "supergroup" ? "Supergroup" : t.chatType === "group" ? "Group" : "Channel"} · ${t.chatId}`,
        imageUrl: placeholderImage("telegram"),
        path: `/channels/telegram`,
        telegramChatId: String(t.chatId),
      }));

    const emptyBanner =
      cards.length === 0
        ? {
            tone: "amber",
            text: "No Telegram channel or group saved yet. Open Create post and add a target (chat id + title) before publishing.",
          }
        : null;

    return {
      title: "Telegram targets",
      description:
        "Post via your connected bot to channels and groups where the bot is a member (admin in channels). Save each chat under Create post.",
      primaryCtaLabel: "Create post",
      cards,
      emptyBanner,
    };
  }

  if (platformKey === "discord") {
    const rawTargets = Array.isArray(account.metadata?.discordTargets) ? account.metadata.discordTargets : [];
    /** @type {PostingTargetCard[]} */
    const cards = rawTargets
      .filter((t) => t && t.channelId)
      .map((t) => ({
        key: `dc-${String(t.guildId || "wh")}-${String(t.channelId)}-${String(t.connectionType || "bot")}`,
        badge: "channel",
        title: `${t.guildName || "Server"} → ${t.channelName ? `#${t.channelName}` : String(t.channelId)}`,
        sublabel: `${String(t.connectionType).toLowerCase() === "webhook" ? "Webhook" : "Bot"} · channel ${t.channelId}`,
        imageUrl: placeholderImage("discord"),
        path: `/channels/discord`,
        discordPreset: { guildId: String(t.guildId || "").trim(), channelId: String(t.channelId) },
      }));

    const emptyBanner =
      cards.length === 0
        ? {
            tone: "amber",
            text: "No Discord channel saved yet. Open Create post and add a bot or webhook target before publishing.",
          }
        : null;

    return {
      title: "Discord channels",
      description:
        "Post via your server bot (DISCORD_BOT_TOKEN) or a channel webhook. Save each target under Create post — webhook URLs are stored only on the server.",
      primaryCtaLabel: "Create post",
      cards,
      emptyBanner,
    };
  }

  if (platformKey === "googleBusiness") {
    const locationRows = entities
      .filter((e) => e.entityType === "location" && e.entityId)
      .sort((a, b) => entityDisplayName(a).localeCompare(entityDisplayName(b)));

    /** @type {PostingTargetCard[]} */
    const cards = [];
    for (const loc of locationRows) {
      const managed = loc.metadata?.managedEntity || {};
      const accountId = String(managed.googleBusinessAccountId || loc.metadata?.googleBusinessAccountId || "").trim();
      const locationId = String(loc.entityId || "").trim();
      if (!accountId || !locationId) continue;
      cards.push({
        key: `gbl-${accountId}-${locationId}`,
        badge: "page",
        title: entityDisplayName(loc),
        sublabel: `Google Business · Account ${accountId} · Location ${locationId}`,
        imageUrl: loc.profileImage || placeholderImage("googleBusiness"),
        path: `/channels/googleBusiness`,
        googleBusinessPreset: { accountId, locationId },
      });
    }

    const emptyBanner =
      cards.length === 0
        ? {
            tone: "neutral",
            text: "No Google Business Profile location connected. Please connect a location first.",
          }
        : null;

    return {
      title: "Business locations",
      description:
        "Publish local posts to a verified Business Profile location you manage. Pick a location below or choose it in the composer.",
      primaryCtaLabel: "Create post",
      primaryCtaPath: `/channels/googleBusiness`,
      cards,
      emptyBanner,
    };
  }

  return null;
}
