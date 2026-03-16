import { createFileRoute } from "@tanstack/react-router";
import { RemarketingForm } from "@/components/remarketing-form";

export const Route = createFileRoute("/_auth/remarketings/$remarketingId/edit")({
  component: EditRemarketingPage,
});

function EditRemarketingPage() {
  const { remarketingId } = Route.useParams();
  return <RemarketingForm mode="edit" remarketingId={remarketingId} />;
}
