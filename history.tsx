import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  History,
  Flame,
  Wind,
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Camera,
  Satellite,
  Calendar,
  Layers,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { RiskBadge } from "@/components/RiskBadge";
import { DemoBadge } from "@/components/DemoBadge";
import { DetectionResultCard } from "@/components/DetectionResultCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { demoHistory } from "@/data/demoData";
import { getHistory, isBackendConfigured, DEMO_MODE } from "@/services/api";
import type { Detection, DetectionType, RiskLevel } from "@/types";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Detection History — ThermoGuard AI Fire Intelligence" },
      {
        name: "description",
        content:
          "Audit archive of historical AI drone/camera fire inferences and satellite hotspot records.",
      },
      { property: "og:title", content: "Detection History — ThermoGuard AI" },
      {
        property: "og:description",
        content: "Complete historical audit log of AI fire and smoke detection events.",
      },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const [history, setHistory] = useState<Detection[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDemo, setIsDemo] = useState<boolean>(!isBackendConfigured || DEMO_MODE);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [riskFilter, setRiskFilter] = useState<string>("ALL");
  const [sourceFilter, setSourceFilter] = useState<string>("ALL");

  // Selected detection for detailed inspection modal
  const [inspectedDetection, setInspectedDetection] = useState<Detection | null>(null);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      if (isBackendConfigured) {
        const data = await getHistory();
        setHistory(data);
        setIsDemo(false);
      } else {
        setHistory(demoHistory);
        setIsDemo(true);
      }
    } catch (err) {
      console.warn("Backend getHistory failed, falling back to demo history:", err);
      setHistory(demoHistory);
      setIsDemo(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Filtered dataset
  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      // Source filter
      if (sourceFilter !== "ALL" && item.source !== sourceFilter) {
        return false;
      }
      // Type filter
      if (typeFilter !== "ALL" && item.type !== typeFilter) {
        return false;
      }
      // Risk filter
      if (riskFilter !== "ALL" && item.risk !== riskFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesLocation = item.location.label?.toLowerCase().includes(q);
        const matchesCoords =
          item.location.latitude.toString().includes(q) ||
          item.location.longitude.toString().includes(q);
        const matchesFacility = item.nearestFacility?.name.toLowerCase().includes(q);
        const matchesId = item.id.toLowerCase().includes(q);
        if (!matchesLocation && !matchesCoords && !matchesFacility && !matchesId) {
          return false;
        }
      }
      return true;
    });
  }, [history, sourceFilter, typeFilter, riskFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = history.length;
    const aiCount = history.filter((h) => h.source === "AI_IMAGE").length;
    const satCount = history.filter((h) => h.source === "SATELLITE").length;
    const highRiskCount = history.filter((h) => h.risk === "HIGH").length;
    const highRiskPct = total > 0 ? Math.round((highRiskCount / total) * 100) : 0;

    return { total, aiCount, satCount, highRiskPct };
  }, [history]);

  return (
    <AppShell
      title="Detection History Archive"
      subtitle="Comprehensive audit trail of AI optical/thermal inferences, satellite observations, and incident verification results."
      actions={
        <div className="flex items-center gap-2">
          {isDemo ? (
            <DemoBadge text={isBackendConfigured ? "DEMO DATA" : "DEMO DATA — BACKEND OFFLINE"} />
          ) : null}
          <Button
            size="sm"
            variant="outline"
            onClick={fetchHistory}
            disabled={isLoading}
            className="h-8 text-xs"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh Log
          </Button>
        </div>
      }
    >
      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Historical Events"
          value={stats.total}
          icon={History}
          tone="default"
          hint="All archived detections"
        />
        <StatCard
          label="AI Optical / Thermal"
          value={stats.aiCount}
          icon={Camera}
          tone="accent"
          hint="Drone and CCTV camera analysis"
        />
        <StatCard
          label="Satellite Hotspots"
          value={stats.satCount}
          icon={Satellite}
          tone="fire"
          hint="VIIRS & MODIS orbital observations"
        />
        <StatCard
          label="High Risk Rate"
          value={`${stats.highRiskPct}%`}
          icon={Flame}
          tone="risk"
          hint="Proportion of critical alerts"
        />
      </div>

      {/* Filter and Search Controls */}
      <div className="panel mt-6 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative min-w-[14rem]">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search location, facility, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>

            {/* Source selector */}
            <div className="flex items-center gap-1.5">
              <span className="label-caps">Source:</span>
              <div className="flex rounded-md border border-border bg-background p-0.5 text-xs">
                {["ALL", "AI_IMAGE", "SATELLITE"].map((src) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setSourceFilter(src)}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                      sourceFilter === src
                        ? "bg-surface font-semibold text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {src === "ALL" ? "All" : src === "AI_IMAGE" ? "AI Camera" : "Satellite"}
                  </button>
                ))}
              </div>
            </div>

            {/* Type selector */}
            <div className="flex items-center gap-1.5">
              <span className="label-caps">Type:</span>
              <div className="flex rounded-md border border-border bg-background p-0.5 text-xs">
                {["ALL", "FIRE", "SMOKE", "NONE"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setTypeFilter(type)}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                      typeFilter === type
                        ? "bg-surface font-semibold text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Risk filter */}
            <div className="flex items-center gap-1.5">
              <span className="label-caps">Risk:</span>
              <div className="flex rounded-md border border-border bg-background p-0.5 text-xs">
                {["ALL", "HIGH", "MEDIUM", "LOW"].map((risk) => (
                  <button
                    key={risk}
                    type="button"
                    onClick={() => setRiskFilter(risk)}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                      riskFilter === risk
                        ? "bg-surface font-semibold text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {risk}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            Displaying <strong className="text-foreground">{filteredHistory.length}</strong> matching records
          </div>
        </div>
      </div>

      {/* History Data Table */}
      <div className="mt-6 panel overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border bg-surface/80 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider">Time</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider">Source</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider">Detection Type</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider">Confidence</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider">Location</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider">Nearest Facility</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider">Prototype Risk</th>
              <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {filteredHistory.length > 0 ? (
              filteredHistory.map((item) => {
                const isFire = item.type === "FIRE";
                const isSmoke = item.type === "SMOKE";
                const isSatellite = item.source === "SATELLITE";

                return (
                  <tr
                    key={item.id}
                    onClick={() => setInspectedDetection(item)}
                    className="cursor-pointer transition-colors hover:bg-surface/50"
                  >
                    {/* Timestamp */}
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      {new Date(item.detectedAt).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>

                    {/* Source */}
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 font-medium text-foreground">
                        {isSatellite ? (
                          <>
                            <Satellite className="size-3 text-accent" /> Satellite
                          </>
                        ) : (
                          <>
                            <Camera className="size-3 text-primary" /> AI Camera
                          </>
                        )}
                      </span>
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3 font-medium">
                      <span className="flex items-center gap-1.5">
                        <span>{isFire ? "🔥" : isSmoke ? "💨" : "🛡️"}</span>
                        <span>{item.type}</span>
                      </span>
                    </td>

                    {/* Confidence */}
                    <td className="px-4 py-3 font-mono">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-14 rounded-full bg-background overflow-hidden border border-border">
                          <div
                            className={`h-full ${
                              item.confidence > 0.8
                                ? "bg-fire"
                                : item.confidence > 0.5
                                  ? "bg-risk-medium"
                                  : "bg-risk-low"
                            }`}
                            style={{ width: `${Math.round(item.confidence * 100)}%` }}
                          />
                        </div>
                        <span>{Math.round(item.confidence * 100)}%</span>
                      </div>
                    </td>

                    {/* Coordinates & Location */}
                    <td className="px-4 py-3">
                      <div>
                        <span className="text-foreground font-medium">
                          {item.location.label ?? "Monitored Zone"}
                        </span>
                        <p className="font-mono text-[0.68rem] text-muted-foreground">
                          {item.location.latitude.toFixed(3)}, {item.location.longitude.toFixed(3)}
                        </p>
                      </div>
                    </td>

                    {/* Nearest Facility */}
                    <td className="px-4 py-3">
                      {item.nearestFacility?.name ? (
                        <div>
                          <span className="text-foreground truncate max-w-[12rem] block">
                            {item.nearestFacility.name}
                          </span>
                          <span className="font-mono text-[0.68rem] text-muted-foreground">
                            {item.nearestFacility.distanceKm?.toFixed(1)} km away
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Risk Badge */}
                    <td className="px-4 py-3">
                      <RiskBadge risk={item.risk} />
                    </td>

                    {/* Inspect Button */}
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setInspectedDetection(item);
                        }}
                      >
                        <Eye className="size-3" /> Inspect
                      </Button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                  No detection history records match the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detection Inspection Dialog */}
      <Dialog
        open={Boolean(inspectedDetection)}
        onOpenChange={(open) => !open && setInspectedDetection(null)}
      >
        <DialogContent className="max-w-lg bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Eye className="size-4 text-primary" /> Detection Record Inspection
            </DialogTitle>
          </DialogHeader>

          {inspectedDetection ? (
            <div className="mt-2 space-y-4">
              <DetectionResultCard detection={inspectedDetection} />

              <div className="rounded-lg border border-border bg-background/50 p-3 text-xs">
                <span className="label-caps">Telemetry Details</span>
                <dl className="mt-2 grid grid-cols-2 gap-2 font-mono">
                  <div>
                    <dt className="text-muted-foreground">Record ID</dt>
                    <dd className="text-foreground">{inspectedDetection.id}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Source Stream</dt>
                    <dd className="text-foreground">{inspectedDetection.source ?? "AI_IMAGE"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Workflow Status</dt>
                    <dd className="text-foreground">{inspectedDetection.status ?? "Resolved"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Timestamp</dt>
                    <dd className="text-foreground">
                      {new Date(inspectedDetection.detectedAt).toLocaleString()}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
