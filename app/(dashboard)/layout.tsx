import { ConditionalHeader } from "@/components/ConditionalHeader";
import { DashboardClientGuard } from "@/components/DashboardClientGuard";
import { Sidebar } from "@/components/Sidebar";
import { Suspense } from "react";
import { ProjectProvider } from "@/context/ProjectContext";
import { TourProvider } from "@/demo/tour-context";
import { DemoSpotlightOverlay } from "@/components/demo/DemoSpotlightOverlay";
import { DemoTooltip } from "@/components/demo/DemoTooltip";
import { DemoCursor } from "@/components/demo/DemoCursor";
import { DemoControlDock } from "@/components/demo/DemoControlDock";
import { DemoLauncherModal } from "@/components/demo/DemoLauncherModal";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div className="h-screen bg-gray-900" />}>
      <DashboardClientGuard>
        <TourProvider>
          <ProjectProvider>
            <div className="flex h-screen bg-gray-100 uppercase-sidebar-fix">
              <Sidebar />
              <div className="flex-1 flex flex-col min-w-0 h-full">
                <ConditionalHeader />
                <main className="flex-1 min-h-0 overflow-auto bg-gray-50">{children}</main>
              </div>
            </div>
            <DemoSpotlightOverlay />
            <DemoTooltip />
            <DemoCursor />
            <DemoControlDock />
            <DemoLauncherModal />
          </ProjectProvider>
        </TourProvider>
      </DashboardClientGuard>
    </Suspense>
  );
}
