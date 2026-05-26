import { Outlet } from "react-router-dom";

import PmsSidebar from "@/components/PmsSidebar";

export default function AppLayout() {
  return (
    <div className="flex h-screen min-h-screen overflow-hidden bg-[#f5f5f7]">
      <PmsSidebar />
      <main className="min-w-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,_#f5f5f7_0%,_#fbfbfd_100%)]">
        <Outlet />
      </main>
    </div>
  );
}
