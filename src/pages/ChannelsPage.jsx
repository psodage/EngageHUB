import ChannelsConnectionsPanel from "../components/channels/ChannelsConnectionsPanel";
import DashboardPageShell from "../components/layout/DashboardPageShell";

export default function ChannelsPage() {
  return (
    <DashboardPageShell>
      <ChannelsConnectionsPanel variant="channels" showHeader={false} />
    </DashboardPageShell>
  );
}
