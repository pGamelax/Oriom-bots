import { createFileRoute } from "@tanstack/react-router";
import { FlowForm } from "@/components/flow-form";

export const Route = createFileRoute("/_auth/flows/new")({
  component: NewFlowPage,
});

function NewFlowPage() {
  return <FlowForm mode="create" />;
}
