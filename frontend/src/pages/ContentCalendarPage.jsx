import DashboardPageShell from "../components/layout/DashboardPageShell";
import SharedCalendar from "../components/schedule/SharedCalendar";

export default function ContentCalendarPage() {
  return (
    <DashboardPageShell description="Your content calendar with drag-and-drop scheduling.">
      <SharedCalendar />
    </DashboardPageShell>
  );
}
