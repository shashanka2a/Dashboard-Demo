"use client";

import { ProjectDetailScreen } from "@/components/ProjectDetailScreen";
import { Activity } from "lucide-react";

export default function InsightsSummaryPage() {
  return (
    <div data-tour="insights-header" className="h-full bg-gray-50">
       <ProjectDetailScreen
         title="Insights"
         icon={Activity}
         dataType="activity"
         excludeTestProjects
       />
    </div>
  );
}
