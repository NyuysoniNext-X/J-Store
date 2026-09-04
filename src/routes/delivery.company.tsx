import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/delivery/company")({
  component: DeliveryCompanyRedirect,
  head: () => ({ meta: [{ title: "Delivery company — J-STORE.cm" }] }),
});

function DeliveryCompanyRedirect() {
  return <Navigate to="/delivery/apply" replace />;
}
