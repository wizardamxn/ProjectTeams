import { Outlet } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";

export default function Layout() {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-zinc-800">
      {/* 1. Navbar (Sticky on Top) */}
      <Navbar />

      {/* 2. Main Content Wrapper */}
      <div className="max-w-[1600px] mx-auto flex flex-1">
        
        {/* 3. Sidebar (Fixed Left) */}
        <Sidebar />

        {/* 4. Dynamic Page Content (The "Outlet") */}
        <main className="flex-1 w-full min-w-0 p-4 md:p-6">
           <Outlet /> 
        </main>
      </div>
    </div>
  );
}