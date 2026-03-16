import { createFileRoute } from "@tanstack/react-router";
import { FlowForm } from "@/components/flow-form";

export const Route = createFileRoute("/_auth/flows/$flowId/edit")({
  component: EditFlowPage,
});

function EditFlowPage() {
  const { flowId } = Route.useParams();
  return <FlowForm mode="edit" flowId={flowId} />;
}
