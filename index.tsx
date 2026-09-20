import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BellRing, Flame, Radar, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { ThermoMap } from "@/components/ThermoMap";
import { DemoBadge } from "@/components/DemoBadge";
import { demoAlerts, demoFireEvents } from "@/data/demoData";
import { detectionToMarker } from "@/lib/markers";
import { DEMO_MODE, isBackendConfigured } from "@/services/api";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — ThermoGuard AI Fire Intelligence" },
      {
        name: "description",
        content:
          "ThermoGuard AI command center: fire events, AI detections and prototype risk assessment on a live operations map.",
      },
      { property: "og:title", content: "Dashboard — ThermoGuard AI Fire Intelligence" },
      {
        property: "og:description",
        content:
          "Command-center dashboard for AI fire detection and satellite-derived fire observations.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [selected, setSelected] = useState<string | null>(null);
  const events = DEMO_MODE ? demoFireEvents : [];
  const markers = useMemo(() => events.map(detectionToMarker), [events]);

  const stats = {
    active: events.filter((e) => e.status !== "Resolved").length,
    ai: events.filter((e) => e.confidence >= 0.5).length,
    high: events.filter((e) => e.risk === "HIGH").length,
    alerts: DEMO_MODE ? demoAlerts.length : 0,
  };

  return (
    <AppShell
      title="Command Dashboard"
      subtitle="Operational overview of AI image detections and satellite-derived fire observations."
      actions={
        <Button asChild size="sm" variant="secondary">
          <Link to="/ai-analysis">Run AI analysis</Link>
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active Fire Events" value={stats.active} icon={Flame} tone="fire" />
        <StatCard label="AI Detections" value={stats.ai} icon={Radar} tone="accent" />
        <StatCard label="High-Risk Events" value={stats.high} icon={ShieldAlert} tone="risk" />
        <StatCard label="Alerts Generated" value={stats.alerts} icon={BellRing} />
      </div>

      <section className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em]">Live Fire Map</h2>
          {DEMO_MODE ? (
            <DemoBadge text={isBackendConfigured ? "Demo data" : "Demo data — backend not connected"} />
          ) : null}
        </div>
        <ThermoMap
          markers={markers}
          selectedMarker={selected}
          onSelectMarker={setSelected}
          zoom={4.6}
          className="h-[26rem] w-full md:h-[34rem]"
        />
        {!DEMO_MODE && !isBackendConfigured ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Backend not connected — no observations to display.
          </p>
        ) : null}
      </section>
    </AppShell>
  );
}
