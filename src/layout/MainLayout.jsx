import Sidebar from "../ui/Sidebar";

export default function MainLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex">
        <Sidebar />

        {/* Content */}
        <main className="flex-1 p-6">
          <div className="mx-auto w-full max-w-6xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
