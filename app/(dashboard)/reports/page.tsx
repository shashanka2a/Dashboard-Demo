import { ReportsScreen } from "@/components/ReportsScreen";

/** Client-driven load so sidebar navigation shows the Reports shell immediately (no blocking RSC). */
export default function ReportsPage() {
  return <ReportsScreen excludeTestProjects />;
}
