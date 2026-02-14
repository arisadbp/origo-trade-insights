import { useState } from "react";
import { Bell, ChevronDown, HelpCircle, Menu } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { adminNavItems, mainNavItems, type NavItem } from "./navItems";
import { useAuth } from "@/contexts/AuthContext";

interface TopBarProps {
  title?: string;
  subtitle?: string;
}

function MobileMenuSection({
  sectionTitle,
  items,
  pathname,
  closeMenu,
}: {
  sectionTitle: string;
  items: NavItem[];
  pathname: string;
  closeMenu: () => void;
}) {
  return (
    <div className="space-y-2">
      <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {sectionTitle}
      </p>
      <div className="space-y-1">
        {items.map((item) => {
          const activeParent =
            pathname === item.href ||
            pathname.startsWith(`${item.href}/`) ||
            item.children?.some((child) => child.href === pathname);

          return (
            <div key={item.title} className="space-y-1">
              <SheetClose asChild>
                <NavLink
                  to={item.href}
                  onClick={closeMenu}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                    activeParent
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="font-medium">{item.title}</span>
                </NavLink>
              </SheetClose>

              {item.children && (
                <div className="space-y-1 pl-6">
                  {item.children.map((child) => {
                    const activeChild = pathname === child.href;

                    return (
                      <SheetClose asChild key={child.href}>
                        <NavLink
                          to={child.href}
                          onClick={closeMenu}
                          className={cn(
                            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                            activeChild
                              ? "bg-secondary text-foreground"
                              : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
                          )}
                        >
                          <child.icon className="h-3.5 w-3.5" />
                          <span>{child.title}</span>
                        </NavLink>
                      </SheetClose>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TopBar({ title, subtitle }: TopBarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { accountType, displayName, email, logout } = useAuth();
  const isBackOffice = accountType === "backoffice";
  const mobileMainItems = isBackOffice ? [] : mainNavItems;
  const mobileAdminItems = isBackOffice ? adminNavItems : [];

  return (
    <header className="origo-topbar sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card/88 px-2 backdrop-blur-sm sm:px-3 md:h-16 md:px-6">
      <div className="flex min-w-0 items-center gap-2 md:gap-4">
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[88%] max-w-xs p-0">
            <div className="flex h-full flex-col">
              <div className="border-b px-4 py-4">
                <div className="flex items-center gap-3">
                  <img src="/logo-origo.svg" alt="Origo logo" className="h-8 w-8 rounded-lg" />
                  <div>
                    <p className="text-sm font-semibold">ORIGO Trade Insights</p>
                    <p className="text-xs text-muted-foreground">Navigation</p>
                  </div>
                </div>
              </div>

              <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
                {mobileMainItems.length > 0 && (
                  <MobileMenuSection
                    sectionTitle="Main"
                    items={mobileMainItems}
                    pathname={location.pathname}
                    closeMenu={() => setMobileMenuOpen(false)}
                  />
                )}
                {mobileAdminItems.length > 0 && (
                  <MobileMenuSection
                    sectionTitle="Back Office"
                    items={mobileAdminItems}
                    pathname={location.pathname}
                    closeMenu={() => setMobileMenuOpen(false)}
                  />
                )}
              </nav>
            </div>
          </SheetContent>
        </Sheet>

        {title && (
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-foreground md:text-lg">
              {title}
            </h1>
            {subtitle && (
              <p className="hidden text-sm text-muted-foreground md:block">{subtitle}</p>
            )}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <Button variant="ghost" size="icon" className="hidden text-muted-foreground sm:inline-flex">
          <HelpCircle className="h-5 w-5" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative text-muted-foreground">
              <Bell className="h-5 w-5" />
              <Badge className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center p-0 text-xs bg-destructive">
                3
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[92vw] max-w-sm bg-popover sm:w-80">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-destructive" />
                <span className="font-medium text-sm">3 Overdue Invoices</span>
              </div>
              <span className="ml-4 text-xs text-muted-foreground">
                Total outstanding: $45,200
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-warning" />
                <span className="font-medium text-sm">Shipment Delay</span>
              </div>
              <span className="ml-4 text-xs text-muted-foreground">
                Order #ORD-2024-0158 delayed by 2 days
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-success" />
                <span className="font-medium text-sm">New Market Data</span>
              </div>
              <span className="ml-4 text-xs text-muted-foreground">
                Q4 2024 data now available for HS 0901
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="ml-1 gap-2 px-1.5 sm:px-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                  {displayName.slice(0, 2).toUpperCase() || "US"}
                </AvatarFallback>
              </Avatar>
              <div className="hidden lg:flex flex-col items-start">
                <span className="text-sm font-medium">{displayName || "User"}</span>
                <span className="text-xs text-muted-foreground">
                  {isBackOffice ? "Back Office" : "Customer Account"}
                </span>
              </div>
              <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-popover">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>{email || "No email"}</DropdownMenuItem>
            <DropdownMenuItem>{isBackOffice ? "Back Office session" : "Customer session"}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => {
                const currentType = accountType;
                logout();
                navigate(currentType === "backoffice" ? "/backoffice/login" : "/login", { replace: true });
              }}
            >
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
