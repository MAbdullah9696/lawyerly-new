import { PublicNavbar } from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col has-disclaimer">
      <PublicNavbar />
      <main className="flex-1">{children}</main>
      <PublicFooter />
      <DisclaimerBanner />
    </div>
  );
}
