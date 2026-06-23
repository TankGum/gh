import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AntdProvider from "@/components/layout/AntdProvider";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { GoogleOAuthProvider } from "@react-oauth/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GoodHair - Quản lý hệ thống",
  description: "Hệ thống quản lý chuỗi cắt tóc GoodHair",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={`${inter.className}`}>
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ""}>
          <AntdProvider>
            <SidebarProvider>{children}</SidebarProvider>
          </AntdProvider>
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}
