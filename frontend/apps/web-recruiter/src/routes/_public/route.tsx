import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layouts/PublicLayout";

export const Route = createFileRoute("/_public")({
  component: PublicLayout,
});
