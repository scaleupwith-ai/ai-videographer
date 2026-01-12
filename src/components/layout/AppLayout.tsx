"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Film,
  FolderOpen,
  Library,
  Plus,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  title: string;
  status: "draft" | "rendering" | "finished" | "failed";
  updatedAt: string;
}

interface AppLayoutProps {
  children: React.ReactNode;
  projects?: Project[];
}

const statusColors = {
  draft: "bg-muted text-muted-foreground",
  rendering: "bg-chart-1/20 text-chart-1 animate-pulse",
  finished: "bg-chart-2/20 text-chart-2",
  failed: "bg-destructive/20 text-destructive",
};

const statusLabels = {
  draft: "Draft",
  rendering: "Rendering",
  finished: "Finished",
  failed: "Failed",
};

export function AppLayout({ children, projects = [] }: AppLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const navItems = [
    { href: "/app", icon: FolderOpen, label: "Projects" },
    { href: "/app/library", icon: Library, label: "Library" },
  ];

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-screen bg-background">
        {/* Sidebar */}
        <aside
          className={cn(
            "flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
            collapsed ? "w-16" : "w-64"
          )}
        >
          {/* Logo */}
          <div className="flex h-14 items-center justify-between px-4 border-b border-sidebar-border">
            {!collapsed && (
              <Link href="/app" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Film className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="font-semibold text-sidebar-foreground">
                  AI Videographer
                </span>
              </Link>
            )}
            {collapsed && (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto">
                <Film className="w-5 h-5 text-primary-foreground" />
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="p-2 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      )}
                    >
                      <item.icon className="w-5 h-5 shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  </TooltipTrigger>
                  {collapsed && (
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </nav>

          {/* Create New Video Button - Centered */}
          <div className="flex-1 flex items-center justify-center p-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => router.push("/app/new")}
                  size={collapsed ? "icon" : "default"}
                  className={cn(
                    "bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg animate-pulse-glow transition-all",
                    collapsed
                      ? "w-12 h-12 rounded-full"
                      : "w-full h-14 rounded-xl text-base gap-2"
                  )}
                >
                  <Plus className={cn("shrink-0", collapsed ? "w-6 h-6" : "w-5 h-5")} />
                  {!collapsed && "Create New Video"}
                </Button>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right">Create New Video</TooltipContent>
              )}
            </Tooltip>
          </div>

          {/* Projects List */}
          <div className={cn("border-t border-sidebar-border", collapsed ? "hidden" : "block")}>
            <div className="px-4 py-2">
              <span className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
                Recent Projects
              </span>
            </div>
            <ScrollArea className="h-48">
              <div className="px-2 pb-2 space-y-1">
                {projects.length === 0 ? (
                  <p className="text-xs text-sidebar-foreground/40 px-2 py-4 text-center">
                    No projects yet
                  </p>
                ) : (
                  projects.slice(0, 10).map((project) => (
                    <Link
                      key={project.id}
                      href={`/app/projects/${project.id}`}
                      className={cn(
                        "flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors",
                        pathname === `/app/projects/${project.id}`
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
                      )}
                    >
                      <div className="flex-1 truncate">{project.title}</div>
                      <Badge
                        variant="secondary"
                        className={cn("text-xs shrink-0", statusColors[project.status])}
                      >
                        {statusLabels[project.status]}
                      </Badge>
                    </Link>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          <Separator className="bg-sidebar-border" />

          {/* Bottom actions */}
          <div className="p-2 space-y-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/app/settings"
                  className="flex items-center gap-3 px-3 py-2 rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
                >
                  <Settings className="w-5 h-5 shrink-0" />
                  {!collapsed && <span>Settings</span>}
                </Link>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">Settings</TooltipContent>}
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    // TODO: Implement logout
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
                >
                  <LogOut className="w-5 h-5 shrink-0" />
                  {!collapsed && <span>Sign Out</span>}
                </button>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">Sign Out</TooltipContent>}
            </Tooltip>
          </div>

          {/* Collapse toggle */}
          <div className="p-2 border-t border-sidebar-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCollapsed(!collapsed)}
              className="w-full justify-center text-sidebar-foreground/50 hover:text-sidebar-foreground"
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <>
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Collapse
                </>
              )}
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </TooltipProvider>
  );
}

