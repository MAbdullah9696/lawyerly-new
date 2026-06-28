import type { Metadata } from "next";
import "./globals.css";
import { AdminProvider } from "@/lib/auth-context";

export const metadata: Metadata = { title: "Lawyerly Admin", robots: { index: false, follow: false } };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AdminProvider>{children}</AdminProvider>
      </body>
    </html>
  );
}
