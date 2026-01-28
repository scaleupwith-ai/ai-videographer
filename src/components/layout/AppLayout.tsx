"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Film,
  FolderOpen,
  ImageIcon,
  Plus,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Globe,
  LayoutTemplate,
  UserSquare2,
  Video,
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
import { ThemeToggle } from "@/components/theme-toggle";
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
    { href: "/app/talking-head", icon: UserSquare2, label: "Talking Head" },
    { href: "/app/jobs", icon: Video, label: "Video Analysis" },
    { href: "/app/templates", icon: LayoutTemplate, label: "Templates" },
    { href: "/app/assets", icon: ImageIcon, label: "My Assets" },
    { href: "/app/public-assets", icon: Globe, label: "Public Assets" },
    { href: "/app/billing", icon: CreditCard, label: "Billing" },
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
          <div className="flex h-14 items-center justify-between px-3 border-b border-sidebar-border">
            {!collapsed && (
              <>
                <Link href="/app" className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <Film className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <span className="font-semibold text-sidebar-foreground">
                    AI Videographer
                  </span>
                </Link>
                <div className="flex items-center gap-1">
                  <ThemeToggle />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCollapsed(true)}
                        className="h-8 w-8 text-sidebar-foreground/50 hover:text-sidebar-foreground"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Collapse Sidebar</TooltipContent>
                  </Tooltip>
                </div>
              </>
            )}
            {collapsed && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setCollapsed(false)}
                    className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto hover:scale-105 transition-transform"
                  >
                    <ChevronRight className="w-5 h-5 text-primary-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Expand Sidebar</TooltipContent>
              </Tooltip>
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

          {/* Create New Video Button - Circle with + */}
          <div className="flex-1 flex items-center justify-center p-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => router.push("/app/new")}
                  size="icon"
                  className="w-14 h-14 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg animate-pulse-glow transition-all hover:scale-105"
                >
                  <Plus className="w-7 h-7" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Create New Video</TooltipContent>
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
                        "flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors overflow-hidden",
                        pathname === `/app/projects/${project.id}`
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
                      )}
                    >
                      <div className="flex-1 min-w-0 truncate max-w-[100px]">{project.title}</div>
                      <Badge
                        variant="secondary"
                        className={cn("text-[10px] shrink-0 px-1.5 py-0.5", statusColors[project.status])}
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
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          {children}
        </main>
      </div>
    </TooltipProvider>
  );
}

