import { motion } from "framer-motion";
import PlatformDetailTabBar from "../PlatformDetailTabBar";
import ChannelProfileHeader from "./ChannelProfileHeader";

const panelMotion = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
};

/**
 * Unified shell for /channels/:platformKey — hero, tabs, and tab body in one card.
 */
export default function ChannelProfilePageLayout({
  account,
  platformKey,
  postCount,
  createPostPath,
  onRefresh,
  onAddAccount,
  addingAccount,
  syncing,
  activeTab,
  onTabChange,
  panelClassName = "",
  children,
}) {
  return (
    <div className="channel-page">
      <article className="channel-page-card buffer-card overflow-hidden">
        <ChannelProfileHeader
          account={account}
          platformKey={platformKey}
          postCount={postCount}
          createPostPath={createPostPath}
          onRefresh={onRefresh}
          onAddAccount={onAddAccount}
          addingAccount={addingAccount}
          syncing={syncing}
        />

        <div className="channel-page-tabs">
          <PlatformDetailTabBar active={activeTab} onChange={onTabChange} variant="underline" platformKey={platformKey} />
        </div>

        <motion.div
          key={activeTab}
          className={`channel-page-content ${panelClassName}`.trim()}
          {...panelMotion}
        >
          {children}
        </motion.div>
      </article>
    </div>
  );
}

