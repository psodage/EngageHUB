import SocialAccount from "../../models/SocialAccount.js";
import githubService from "./github.service.js";

function buildGitHubError(message, code, status = 400) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

export async function getConnectedGitHubAccount(userId) {
  const account = await SocialAccount.findOne({ userId, platform: "github", isConnected: true });
  if (!account) {
    throw buildGitHubError("GitHub is not connected.", "github_not_connected", 404);
  }
  const token = account.getDecryptedAccessToken();
  if (!token) {
    throw buildGitHubError("GitHub access token is missing. Reconnect your account.", "github_token_invalid", 401);
  }
  return { account, accessToken: token };
}

function mapRepo(repo) {
  return {
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description || "",
    stars: repo.stargazers_count ?? 0,
    forks: repo.forks_count ?? 0,
    visibility: repo.private ? "private" : "public",
    language: repo.language || "",
    updatedAt: repo.updated_at || null,
    htmlUrl: repo.html_url || "",
    defaultBranch: repo.default_branch || "main",
  };
}

function mapEvent(event) {
  const repo = event.repo?.name || "";
  const actor = event.actor?.login || "";
  const payload = event.payload || {};
  let summary = event.type?.replace(/Event$/i, "") || "Activity";
  let url = "";

  if (event.type === "PushEvent") {
    const commits = Array.isArray(payload.commits) ? payload.commits.length : 0;
    const branch = (payload.ref || "").replace(/^refs\/heads\//, "");
    summary = `Pushed ${commits} commit${commits === 1 ? "" : "s"} to ${branch || "branch"}`;
    url = repo ? `https://github.com/${repo}` : "";
  } else if (event.type === "PullRequestEvent") {
    const action = payload.action || "updated";
    const pr = payload.pull_request;
    summary = `Pull request ${action}: ${pr?.title || "PR"}`;
    url = pr?.html_url || "";
  } else if (event.type === "IssuesEvent") {
    const action = payload.action || "updated";
    const issue = payload.issue;
    summary = `Issue ${action}: ${issue?.title || "Issue"}`;
    url = issue?.html_url || "";
  } else if (event.type === "WatchEvent") {
    summary = `Starred ${repo}`;
    url = repo ? `https://github.com/${repo}` : "";
  } else if (event.type === "CreateEvent") {
    summary = `Created ${payload.ref_type || "resource"} in ${repo}`;
  }

  return {
    id: event.id,
    type: event.type,
    summary,
    repo,
    actor,
    createdAt: event.created_at,
    url,
    rawType: event.type,
  };
}

export async function fetchGitHubRepos(userId, { page = 1, perPage = 30, sort = "updated" } = {}) {
  const { accessToken } = await getConnectedGitHubAccount(userId);
  const repos = await githubService.githubApiGet(accessToken, "/user/repos", {
    per_page: Math.min(perPage, 100),
    page,
    sort,
    direction: "desc",
  });
  return (Array.isArray(repos) ? repos : []).map(mapRepo);
}

export async function syncGitHubAccountMetadata(userId) {
  const { account, accessToken } = await getConnectedGitHubAccount(userId);
  const profile = await githubService.getProfile(accessToken);
  const repos = await fetchGitHubRepos(userId, { perPage: 100 });
  const totalStars = repos.reduce((sum, r) => sum + (r.stars || 0), 0);
  const totalForks = repos.reduce((sum, r) => sum + (r.forks || 0), 0);
  const topRepositories = [...repos]
    .sort((a, b) => b.stars - a.stars)
    .slice(0, 5)
    .map((r) => ({
      name: r.name,
      fullName: r.fullName,
      stars: r.stars,
      forks: r.forks,
      language: r.language,
      htmlUrl: r.htmlUrl,
    }));

  let recentCommits = [];
  try {
    const events = await githubService.githubApiGet(accessToken, "/users/events", { per_page: 30 });
    recentCommits = (Array.isArray(events) ? events : [])
      .filter((e) => e.type === "PushEvent")
      .slice(0, 8)
      .flatMap((e) => {
        const commits = Array.isArray(e.payload?.commits) ? e.payload.commits : [];
        return commits.slice(0, 3).map((c) => ({
          sha: (c.sha || "").slice(0, 7),
          message: c.message || "",
          repo: e.repo?.name || "",
          url: c.url || (e.repo?.name ? `https://github.com/${e.repo.name}` : ""),
          createdAt: e.created_at,
        }));
      })
      .slice(0, 10);
  } catch {
    /* optional */
  }

  const meta = {
    ...(account.metadata || {}),
    ...profile.metadata,
    repositoriesCount: profile.metadata.repositoriesCount ?? repos.length,
    totalStars,
    totalForks,
    topRepositories,
    recentCommits,
    lastSyncedAt: new Date().toISOString(),
  };

  account.accountName = profile.accountName;
  account.username = profile.username;
  account.email = profile.email || account.email;
  account.profileImage = profile.profileImage;
  account.metadata = meta;
  account.lastSyncedAt = new Date();
  account.scopes = account.scopes?.length ? account.scopes : profile.metadata?.scopes;
  await account.save();

  return {
    profile: {
      username: account.username,
      accountName: account.accountName,
      profileImage: account.profileImage,
      metadata: meta,
    },
    repos: repos.slice(0, 20),
    stats: {
      repositoriesCount: meta.repositoriesCount,
      followers: meta.followers ?? 0,
      following: meta.following ?? 0,
      totalStars,
      totalForks,
      contributionStreak: meta.contributionStreak ?? null,
    },
    topRepositories,
    recentCommits,
  };
}

export async function getGitHubAnalytics(userId) {
  const { account } = await getConnectedGitHubAccount(userId);
  const meta = account.metadata || {};
  const needsSync =
    !meta.lastSyncedAt || Date.now() - new Date(meta.lastSyncedAt).getTime() > 15 * 60 * 1000;
  if (needsSync) {
    return syncGitHubAccountMetadata(userId);
  }
  return {
    profile: {
      username: account.username,
      accountName: account.accountName,
      profileImage: account.profileImage,
      metadata: meta,
    },
    stats: {
      repositoriesCount: meta.repositoriesCount ?? 0,
      followers: meta.followers ?? 0,
      following: meta.following ?? 0,
      totalStars: meta.totalStars ?? 0,
      totalForks: meta.totalForks ?? 0,
      contributionStreak: meta.contributionStreak ?? null,
    },
    topRepositories: meta.topRepositories || [],
    recentCommits: meta.recentCommits || [],
  };
}

export async function getGitHubActivityFeed(userId, { perPage = 30 } = {}) {
  const { accessToken, account } = await getConnectedGitHubAccount(userId);
  const username = account.username;
  const path = username ? `/users/${username}/events` : "/user/events";
  const events = await githubService.githubApiGet(accessToken, path, { per_page: Math.min(perPage, 100) });
  return (Array.isArray(events) ? events : []).map(mapEvent);
}
