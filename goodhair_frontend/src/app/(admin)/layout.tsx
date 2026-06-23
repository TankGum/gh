import Sidebar from "@/components/layout/Sidebar";
import MainContent from "@/components/layout/MainContent";
import { AuthProvider } from "@/contexts/AuthContext";
import { BadgeProvider } from "@/contexts/BadgeContext";
import AdminAuthGuard from "./AdminAuthGuard";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AdminAuthGuard>
        <BadgeProvider>
          <div style={{ display: "flex", height: "100vh" }}>
            <Sidebar />
            <MainContent>{children}</MainContent>
          </div>
        </BadgeProvider>
      </AdminAuthGuard>
    </AuthProvider>
  );
}
