import type { Metadata } from "next";
import { StatusPage } from "@/components/StatusPage";

export const metadata: Metadata = { title: "Access denied" };

export default function ForbiddenPage() {
  return (
    <StatusPage
      code="403"
      title="You do not have permission"
      description="Your account isn’t allowed to view this page. If you think this is a mistake, contact support."
      action={{ href: "/login", label: "Switch account" }}
    />
  );
}
