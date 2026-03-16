import { createFileRoute } from "@tanstack/react-router";
import { RemarketingForm } from "@/components/remarketing-form";

export const Route = createFileRoute("/_auth/remarketings/new")({
  component: NewRemarketingPage,
});

function NewRemarketingPage() {
  return <RemarketingForm mode="create" />;
}
