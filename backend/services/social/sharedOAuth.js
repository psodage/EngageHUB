import axios from "axios";

function maskClientId(value) {
  if (!value) return "missing";
  const visible = value.slice(-8);
  return `***${visible}`;
}

function summarizeAxiosError(error) {
  return {
    message: error?.message || "Unknown request error",
    status: error?.response?.status || null,
    statusText: error?.response?.statusText || null,
    data: error?.response?.data || null,
  };
}

function fallbackProfile(platform) {
  return {
    platformUserId: "",
    accountName: "",
    username: "",
    email: "",
    profileImage: "",
    metadata: { capabilities: ["posting", "analytics"] },
  };
}

function buildOAuthError(message, code, details) {
  const err = new Error(message);
  if (code) err.code = code;
  if (details !== undefined) err.details = details;
  return err;
}

function pickProfileImage(data) {
  if (!data || typeof data !== "object") return "";
  if (typeof data.picture === "string") return data.picture;
  if (typeof data.profilePicture === "string") return data.profilePicture;
  return data.picture?.data?.url || "";
}

function pickAccountName(data) {
  if (!data || typeof data !== "object") return "";
  if (typeof data.name === "string" && data.name.trim()) return data.name;
  if (typeof data.localizedFirstName === "string" && data.localizedFirstName.trim()) {
    const first = data.localizedFirstName.trim();
    const last = typeof data.localizedLastName === "string" ? data.localizedLastName.trim() : "";
    return `${first} ${last}`.trim();
  }
  const givenName = typeof data.given_name === "string" ? data.given_name.trim() : "";
  const familyName = typeof data.family_name === "string" ? data.family_name.trim() : "";
  const fullName = `${givenName} ${familyName}`.trim();
  return fullName;
}

export function createOAuthService({
  platform,
  clientId,
  clientSecret,
  redirectUri: redirectUriInput,
  resolveRedirectUri,
  authUrl,
  tokenUrl,
  profileUrl,
  scopes,
  additionalAuthParams = {},
  mapProfile,
  scopeSeparator = " ",
}) {
  const getRedirectUri = () => {
    if (typeof resolveRedirectUri === "function") {
      return resolveRedirectUri() || redirectUriInput || "";
    }
    return redirectUriInput || "";
  };

  function validateConfig() {
    const redirectUri = getRedirectUri();
    return {
      valid: Boolean(clientId && clientSecret && redirectUri),
      missing: [
        ...(!clientId ? ["clientId"] : []),
        ...(!clientSecret ? ["clientSecret"] : []),
        ...(!redirectUri ? ["redirectUri"] : []),
      ],
    };
  }

  function classifyTokenExchangeError(error) {
    const status = error?.response?.status;
    const providerCode = String(
      error?.response?.data?.error ||
        error?.response?.data?.errorCode ||
        error?.response?.data?.code ||
        ""
    ).toLowerCase();
    const providerMessage = String(
      error?.response?.data?.error_description ||
        error?.response?.data?.message ||
        error?.message ||
        ""
    );
    const normalizedMessage = providerMessage.toLowerCase();
    if (providerCode === "invalid_scope" || normalizedMessage.includes("scope")) {
      return "invalid_scope";
    }
    if (
      providerCode === "redirect_uri_mismatch" ||
      normalizedMessage.includes("redirect_uri_mismatch")
    ) {
      return "google_redirect_uri_mismatch";
    }
    if (providerCode === "invalid_grant") {
      return "oauth_code_invalid";
    }
    if (providerCode === "invalid_client") {
      return "invalid_client";
    }
    if (status === 401 || status === 403) {
      return "token_exchange_forbidden";
    }
    return "token_exchange_failed";
  }

  return {
    platform,
    validateConfig,
    getAuthUrl(state, runtimeParams = {}) {
      if (!validateConfig().valid) {
        throw new Error(`${platform} OAuth is not configured.`);
      }
      const redirectUri = getRedirectUri();
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: scopes.join(scopeSeparator),
        state,
        ...additionalAuthParams,
        ...runtimeParams,
      });
      return `${authUrl}?${params.toString()}`;
    },
    async exchangeCodeForToken(code, runtimeParams = {}) {
      if (!validateConfig().valid) {
        throw new Error(`${platform} OAuth is not configured.`);
      }
      const redirectUri = getRedirectUri();

      let data;
      try {
        const tokenHeaders = {
          "Content-Type": "application/x-www-form-urlencoded",
        };
        if (runtimeParams?.useBasicClientAuth) {
          tokenHeaders.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
        }
        const response = await axios.post(
          tokenUrl,
          new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
            code,
            ...(runtimeParams?.codeVerifier ? { code_verifier: runtimeParams.codeVerifier } : {}),
            ...(runtimeParams?.useBasicClientAuth ? {} : { client_secret: clientSecret }),
          }),
          { headers: tokenHeaders }
        );
        data = response.data;
      } catch (error) {
        const providerData = error?.response?.data || null;
        console.error("[oauth:token:error]", {
          platform,
          tokenUrl,
          redirectUri,
          clientId: maskClientId(clientId),
          providerError: providerData?.error,
          providerErrorDescription: providerData?.error_description,
          error: summarizeAxiosError(error),
        });
        const errCode = classifyTokenExchangeError(error);
        const description =
          providerData?.error_description ||
          providerData?.message ||
          error?.message ||
          `Token exchange failed for ${platform}.`;
        throw buildOAuthError(description, errCode, providerData);
      }

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || "",
        tokenType: data.token_type || "Bearer",
        expiresIn: data.expires_in || 60 * 60 * 24 * 30,
        scopes: data.scope ? data.scope.split(/[,\s]+/).filter(Boolean) : scopes,
      };
    },
    async getProfile(accessToken) {
      if (!profileUrl) {
        throw new Error(`Missing profile endpoint for ${platform}.`);
      }

      let data;
      try {
        const response = await axios.get(profileUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        data = response.data;
      } catch (error) {
        console.error("[oauth:profile:error]", {
          platform,
          profileUrl,
          clientId: maskClientId(clientId),
          error: summarizeAxiosError(error),
        });
        const status = error?.response?.status;
        const providerMessage =
          error?.response?.data?.message ||
          error?.response?.data?.error_description ||
          error?.message ||
          "";
        const normalizedMessage = String(providerMessage).toLowerCase();
        const code =
          normalizedMessage.includes("scope") || normalizedMessage.includes("permission")
            ? "invalid_scope"
            : status === 401 || status === 403
              ? "profile_forbidden"
              : "profile_fetch_failed";
        throw buildOAuthError(`Profile fetch failed for ${platform}.`, code, error?.response?.data || null);
      }

      const normalized = {
        platformUserId: data.id?.toString() || data.sub?.toString() || fallbackProfile(platform).platformUserId,
        accountName: pickAccountName(data) || fallbackProfile(platform).accountName,
        username: data.username || data.vanityName || data.preferred_username || "",
        email: data.email || data.emailAddress || "",
        profileImage: pickProfileImage(data),
        metadata: {
          rawProfile: data,
          capabilities: ["posting", "analytics"],
        },
      };

      return typeof mapProfile === "function" ? mapProfile(data, normalized) : normalized;
    },
    async getManagedEntities() {
      return [];
    },
    async publishPost() {
      throw new Error(`${platform} publish is not implemented yet.`);
    },
    async getAnalytics() {
      return { available: false, reason: "Analytics unavailable for this provider tier." };
    },
    async refreshTokenIfNeeded(account) {
      const isExpired = account?.expiresAt && new Date(account.expiresAt).getTime() <= Date.now();
      if (!isExpired) {
        return null;
      }

      if (!account?.getDecryptedRefreshToken?.()) {
        throw new Error("Refresh token unavailable.");
      }

      return {
        accessToken: `refreshed_access_${platform}_${Date.now()}`,
        expiresIn: 60 * 60 * 24 * 30,
        tokenType: "Bearer",
      };
    },
    async disconnectAccount() {
      return { disconnected: true };
    },
  };
}
