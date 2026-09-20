import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/satellite-analysis")({
  beforeLoad: () => {
    throw redirect({
      to: "/satellite-monitoring",
    });
  },
});
