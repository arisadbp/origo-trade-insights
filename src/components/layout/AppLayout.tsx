import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { MobileTabBar } from "./MobileTabBar";

export function AppLayout() {
  return (
    <div className="origo-app-shell flex h-svh w-full overflow-hidden bg-background">
      <div className="hidden shrink-0 md:flex md:h-svh">
        <AppSidebar />
      </div>
      <div className="flex h-svh min-w-0 flex-1 flex-col">
        <main className="origo-content-stage min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
        <MobileTabBar />
      </div>
    </div>
  );
}
