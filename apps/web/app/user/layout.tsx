import { RoleGuard } from "@/components/RoleGuard";
import { UserShell } from "@/components/user/UserShell";

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard mode="role" allow={["citizen"]}>
      <UserShell>{children}</UserShell>
    </RoleGuard>
  );
}
