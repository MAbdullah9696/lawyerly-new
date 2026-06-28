import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { SessionExpiredModal } from "@/components/layout/SessionExpiredModal";
import { NetworkBanner } from "@/components/layout/NetworkBanner";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "Lawyerly — Get Legal Guidance Instantly",
    template: "%s · Lawyerly",
  },
  description:
    "Lawyerly connects Pakistani citizens with verified lawyers, instant AI legal guidance, and secure document analysis.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <NetworkBanner />
          {children}
          <SessionExpiredModal />
        </AuthProvider>
      </body>
    </html>
  );
}
