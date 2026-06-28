import { RoleGuard } from "@/components/RoleGuard";
import { LawyerStatusGate } from "@/components/lawyer/LawyerStatusGate";

export default function LawyerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard mode="role" allow={["lawyer"]}>
      <LawyerStatusGate>{children}</LawyerStatusGate>
    </RoleGuard>
  );
}
