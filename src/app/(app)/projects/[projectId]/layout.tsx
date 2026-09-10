"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { ProjectTabs } from "@/components/features/project/project-tabs";

/** Layout for a project's sub-pages: consistent section navigation. */
export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <ProjectTabs />
      {children}
    </div>
  );
}
