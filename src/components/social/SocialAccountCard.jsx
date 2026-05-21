import { motion } from "framer-motion";
import ConnectionStatusBadge from "./ConnectionStatusBadge";
import ConnectButton from "./ConnectButton";
import TokenExpiryWarning from "./TokenExpiryWarning";
import AccountSyncInfo from "./AccountSyncInfo";
import PlatformBrandIcon from "../channels/PlatformBrandIcon";
import { PLATFORM_CAPABILITY_MATRIX } from "../../data/socialPlatforms";

export default function SocialAccountCard({
  platformConfig,
  account,
  isProcessing,
  onConnect,
  onReconnect,
  onAddAccount,
  onDisconnect,
  onOpenDetails,
  connectTemporarilyDisabled = false,
  variant = "dark",
}) {
  const isBuffer = variant === "buffer";
  const isConnected = !!account?.isConnected;
  const openDetailsEnabled = isConnected && typeof onOpenDetails === "function";
  const displayName = isConnected ? account?.accountName || account?.username || "No Account linked" : "No Account linked";
  const facebookPages =
    platformConfig.key === "facebook" && Array.isArray(account?.entities)
      ? account.entities.filter((item) => item.entityType === "page")
      : [];
  const linkedInOrganizations =
    platformConfig.key === "linkedin" && Array.isArray(account?.entities)
      ? account.entities.filter((item) => item.entityType === "organization")
      : [];
  const linkedInCurrentCompany = linkedInOrganizations[0] || null;
  const linkedInstagram = account?.metadata?.linkedInstagramAccount || account?.metadata?.linkedFacebookPage || null;
  const instagramUserId = account?.metadata?.instagramUserId || account?.platformUserId || "";
  const googleBusinessLocations =
    platformConfig.key === "googleBusiness" && Array.isArray(account?.entities)
      ? account.entities.filter((item) => item.entityType === "location")
      : [];
  const capability = PLATFORM_CAPABILITY_MATRIX[platformConfig.key];
  const badges = account?.capabilities?.length ? account.capabilities : capability?.badges || [];
  const oauthSupported = capability?.oauth !== false;
  const entityTypeLabel =
    account?.entityType === "organization"
      ? "Organization"
      : account?.entityType === "profile"
        ? "Profile"
        : account?.entityType
          ? String(account.entityType)
          : "";

  return (
    <motion.article
      layout
      className={
        isBuffer
          ? "rounded-xl border border-slate-200 bg-white p-4 shadow-card transition hover:border-buffer-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
          : "rounded-2xl border border-slate-700/70 bg-slate-900/65 p-4 shadow-lg backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-blue-400/40"
      }
      whileHover={isBuffer ? undefined : { scale: 1.01 }}
    >
      <div
        className={
          openDetailsEnabled
            ? isBuffer
              ? "cursor-pointer rounded-lg transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-buffer-500/40 dark:hover:bg-slate-800/50"
              : "cursor-pointer rounded-xl outline-none ring-offset-slate-900/65 transition hover:bg-slate-800/40 focus-visible:ring-2 focus-visible:ring-blue-500/70"
            : ""
        }
        role={openDetailsEnabled ? "button" : undefined}
        tabIndex={openDetailsEnabled ? 0 : undefined}
        aria-label={openDetailsEnabled ? `Open ${platformConfig.label} details` : undefined}
        onClick={openDetailsEnabled ? () => onOpenDetails() : undefined}
        onKeyDown={
          openDetailsEnabled
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpenDetails();
                }
              }
            : undefined
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <PlatformBrandIcon platformKey={platformConfig.key} size="sm" />
            <div>
              <p className={`text-sm font-semibold ${isBuffer ? "text-slate-900 dark:text-white" : "text-white"}`}>
                {platformConfig.label}
              </p>
              <p className={`text-xs ${isBuffer ? "text-slate-500" : "text-slate-400"}`}>{platformConfig.hint}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <ConnectionStatusBadge account={account} isConnected={isConnected} />
            {openDetailsEnabled ? (
              <span className={`text-[11px] font-medium ${isBuffer ? "text-buffer-700 dark:text-buffer-400" : "text-blue-300/90"}`}>
                View details
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <img
            src={account?.profileImage || "https://placehold.co/80x80/0f172a/e2e8f0?text=%40"}
            alt={`${platformConfig.label} profile`}
            className={`h-11 w-11 rounded-full object-cover ${isBuffer ? "border border-slate-200 dark:border-slate-700" : "border border-slate-700"}`}
          />
          <div>
            <p className={`text-sm font-medium ${isBuffer ? "text-slate-800 dark:text-slate-100" : "text-slate-100"}`}>{displayName}</p>
            <p className={`text-xs ${isBuffer ? "text-slate-500" : "text-slate-400"}`}>
              {isConnected && entityTypeLabel ? `Type: ${entityTypeLabel}` : "Not connected"}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {badges.map((badge) => (
            <span
              key={`${platformConfig.key}-${badge}`}
              className={
                isBuffer
                  ? "rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  : "rounded-full border border-slate-600 px-2 py-0.5 text-[11px] text-slate-300"
              }
            >
              {badge}
            </span>
          ))}
        </div>

        <div className="mt-4 space-y-1">
          {isConnected && platformConfig.key === "facebook" ? (
            <p className="text-xs text-slate-400">
              {facebookPages.length
                ? `${facebookPages.length} Page${facebookPages.length === 1 ? "" : "s"} connected`
                : "No Facebook Pages connected"}
              {linkedInstagram?.username || linkedInstagram?.name
                ? ` · Instagram linked`
                : facebookPages.length
                  ? " · No Instagram linked"
                  : null}
            </p>
          ) : null}
          {isConnected && platformConfig.key === "instagram" ? (
            <p className="text-xs text-slate-400">
              {instagramUserId ? `Instagram User ID: ${instagramUserId}` : "Instagram user ID unavailable"}
            </p>
          ) : null}
          {isConnected && platformConfig.key === "linkedin" ? (
            <p className="text-xs text-slate-400">
              {linkedInCurrentCompany?.accountName || linkedInCurrentCompany?.name
                ? `Current company: ${linkedInCurrentCompany.accountName || linkedInCurrentCompany.name}`
                : "Current company: Not found"}
              {" - "}
              {`Available companies: ${linkedInOrganizations.length}`}
            </p>
          ) : null}
          {isConnected && platformConfig.key === "github" ? (
            <p className="text-xs text-slate-400">
              {account?.username ? `@${account.username}` : "GitHub user"}
              {" · "}
              {typeof account?.metadata?.repositoriesCount === "number"
                ? `${account.metadata.repositoriesCount} repos`
                : "Repositories syncing…"}
              {typeof account?.metadata?.followers === "number" ? ` · ${account.metadata.followers} followers` : ""}
            </p>
          ) : null}
          {isConnected && platformConfig.key === "googleBusiness" ? (
            <p className="text-xs text-slate-400">
              {googleBusinessLocations[0]?.accountName ||
              googleBusinessLocations[0]?.metadata?.locationTitle ||
              googleBusinessLocations[0]?.entityId
                ? `Primary location: ${
                    googleBusinessLocations[0]?.accountName ||
                    googleBusinessLocations[0]?.metadata?.locationTitle ||
                    "Business location"
                  }`
                : "Google Business Profile connected"}
              {" · "}
              {`Connected locations: ${googleBusinessLocations.length || (account?.isConnected ? 1 : 0)}`}
            </p>
          ) : null}
          <TokenExpiryWarning account={account} />
          <AccountSyncInfo account={account} />
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <ConnectButton
          isConnected={isConnected}
          isProcessing={isProcessing}
          onConnect={onConnect}
          onReconnect={onReconnect}
          onAddAccount={onAddAccount}
          connectLabel={
            platformConfig.key === "instagram"
              ? "Connect Instagram"
              : platformConfig.key === "github"
                ? "Connect GitHub"
                : "Connect"
          }
          connectDisabled={connectTemporarilyDisabled}
        />
        <button
          onClick={onDisconnect}
          disabled={!isConnected || isProcessing}
          className={
            isBuffer
              ? "rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              : "rounded-md border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700/70 disabled:cursor-not-allowed disabled:opacity-40"
          }
        >
          Disconnect
        </button>
      </div>
      {connectTemporarilyDisabled ? (
        <p className="mt-2 text-xs text-slate-400">Connecting is temporarily unavailable for this platform.</p>
      ) : null}
      {!oauthSupported ? <p className="mt-2 text-xs text-amber-300">Bot/manual setup required. OAuth is not available for this platform.</p> : null}
    </motion.article>
  );
}
