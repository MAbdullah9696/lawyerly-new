import { LawyerShell } from "@/components/lawyer/LawyerShell";

export default function LawyerPortalLayout({ children }: { children: React.ReactNode }) {
  return <LawyerShell>{children}</LawyerShell>;
}
