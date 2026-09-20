import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/satellite")({
  beforeLoad: () => {
    throw redirect({
      to: "/satellite-monitoring",
    });
  },
});
