import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { adminNavItems, mainNavItems, type NavItem } from "./navItems";
import { useAuth } from "@/contexts/AuthContext";

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>(["THAI ROONG RUANG INDUSTRY CO., LTD.", "Back Office"]);
  const location = useLocation();
  const { accountType } = useAuth();
  const isBackOffice = accountType === "admin";
  const visibleMainNavItems = isBackOffice ? [] : mainNavItems;
  const visibleAdminNavItems = isBackOffice ? adminNavItems : [];

  const toggleExpand = (title: string) => {
    setExpandedItems((prev) =>
      prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, title]
    );
  };

  const isActive = (href: string) =>
    location.pathname === href || (href !== "/" && location.pathname.startsWith(`${href}/`));
  const isChildActive = (children?: NavItem["children"]) =>
    children?.some((child) => location.pathname === child.href);

  const renderNavItem = (item: NavItem) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.title);
    const active = isActive(item.href) || isChildActive(item.children);

    if (collapsed) {
      return (
        <Tooltip key={item.title} delayDuration={0}>
          <TooltipTrigger asChild>
            <NavLink
              to={item.href}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg transition-colors mx-auto",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
            </NavLink>
          </TooltipTrigger>
          <TooltipContent side="right" className="flex flex-col">
            <span className="font-medium">{item.title}</span>
            <span className="text-xs text-muted-foreground">{item.description}</span>
          </TooltipContent>
        </Tooltip>
      );
    }

    return (
      <div key={item.title}>
        <div
          className={cn(
            "flex items-center justify-between rounded-lg transition-colors cursor-pointer",
            active && !hasChildren
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent/50"
          )}
        >
          <NavLink
            to={hasChildren ? "#" : item.href}
            onClick={(e) => {
              if (hasChildren) {
                e.preventDefault();
                toggleExpand(item.title);
              }
            }}
            className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5"
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            <span className="min-w-0 truncate text-sm font-medium" title={item.title}>
              {item.title}
            </span>
          </NavLink>
          {hasChildren && (
            <button
              onClick={() => toggleExpand(item.title)}
              className="p-2 hover:bg-sidebar-accent rounded-lg mr-1"
            >
              <ChevronRight
                className={cn(
                  "h-4 w-4 transition-transform",
                  isExpanded && "rotate-90"
                )}
              />
            </button>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div className="ml-4 mt-1 space-y-1 border-l border-sidebar-border pl-3">
            {item.children?.map((child) => (
              <NavLink
                key={child.href}
                to={child.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive(child.href)
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <child.icon className="h-4 w-4" />
                {child.title}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className={cn(
        "flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center h-16 border-b border-sidebar-border px-4",
        collapsed && "justify-center px-0"
      )}>
        <div className="flex items-center gap-2">
          <img
            src="/logo-origo.svg"
            alt="Origo logo"
            className="h-8 w-8 rounded-lg"
          />
          {!collapsed && (
            <span className="text-xl font-bold text-sidebar-accent-foreground">
              ORIGO
            </span>
          )}
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 p-3 space-y-1.5">
        {visibleMainNavItems.length > 0 && (
          <div className="space-y-1">
            {visibleMainNavItems.map(renderNavItem)}
          </div>
        )}

        {visibleMainNavItems.length > 0 && visibleAdminNavItems.length > 0 && (
          <div className="my-4 border-t border-sidebar-border" />
        )}

        {visibleAdminNavItems.length > 0 && (
          <div className="space-y-1">
            {visibleAdminNavItems.map(renderNavItem)}
          </div>
        )}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-3 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            collapsed && "px-0"
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-2" />
              <span>Collapse</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
