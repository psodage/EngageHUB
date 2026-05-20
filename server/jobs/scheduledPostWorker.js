import { processDueScheduledPosts } from "../services/social/scheduledPostPublisher.service.js";

const TICK_MS = 30_000;

export function startScheduledPostWorker() {
  const tick = async () => {
    try {
      const count = await processDueScheduledPosts();
      if (count > 0) {
        console.info(`[scheduler] processed ${count} due post(s)`);
      }
    } catch (err) {
      console.error("[scheduler:error]", err?.message);
    }
  };

  tick();
  return setInterval(tick, TICK_MS);
}
