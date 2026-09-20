import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Satellite,
  Flame,
  ShieldAlert,
  Radio,
  Zap,
  Filter,
  RefreshCw,
  Clock,
  Layers,
  MapPin,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { ThermoMap } from "@/components/ThermoMap";
import { DemoBadge } from "@/components/DemoBadge";
import { RiskBadge } from "@/components/RiskBadge";
import { Button } from "@/components/ui/button";
import { demoFireEvents } from "@/data/demoData";
import { detectionToMarker } from "@/lib/markers";
import { getSatelliteFires, isBackendConfigured, DEMO_MODE } from "@/services/api";
import type { FireEvent, RiskLevel } from "@/types";

export const Route = createFileRoute("/satellite-monitoring")({
  head: () => ({
    meta: [
      { title: "Satellite Monitoring — ThermoGuard AI Fire Intelligence" },
      {
        name: "description",
        content:
          "Satellite thermal anomaly tracking via VIIRS and MODIS orbital sensors with prototype risk evaluation.",
      },
      { property: "og:title", content: "Satellite Monitoring — ThermoGuard AI" },
      {
        property: "og:description",
        content: "Real-time thermal hotspot and fire observations from Earth observation satellites.",
      },
    ],
  }),
  component: SatelliteMonitoringPage,
});

function SatelliteMonitoringPage() {
  const [sensorFilter, setSensorFilter] = useState<string>("ALL");
  const [timeRangeHours, setTimeRangeHours] = useState<number>(48);
  const [riskFilter, setRiskFilter] = useState<string>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [fires, setFires] = useState<FireEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDemo, setIsDemo] = useState<boolean>(!isBackendConfigured || DEMO_MODE);

  const fetchFires = async () => {
    setIsLoading(true);
    try {
      if (isBackendConfigured) {
        const params =
          sensorFilter === "ALL"
            ? { timeRangeHours }
            : { timeRangeHours, sensor: sensorFilter };
        const data = await getSatelliteFires(params);
        setFires(data);
        setIsDemo(false);
      } else {
        // Backend not configured: fall back cleanly to demo data
        setFires(demoFireEvents);
        setIsDemo(true);
      }
    } catch (err) {
      console.warn("Satellite fires fetch failed, falling back to demo observations:", err);
      setFires(demoFireEvents);
      setIsDemo(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFires();
  }, [timeRangeHours, sensorFilter]);

  // Client-side filtering for UI controls
  const filteredFires = useMemo(() => {
    return fires.filter((f) => {
      if (sensorFilter !== "ALL" && f.sensor?.toUpperCase() !== sensorFilter) {
        return false;
      }
      if (riskFilter !== "ALL" && f.risk !== riskFilter) {
        return false;
      }
      return true;
    });
  }, [fires, sensorFilter, riskFilter]);

  const markers = useMemo(() => filteredFires.map(detectionToMarker), [filteredFires]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = filteredFires.length;
    const highRisk = filteredFires.filter((f) => f.risk === "HIGH").length;
    const viirsCount = filteredFires.filter((f) => f.sensor?.toUpperCase().includes("VIIRS")).length;
    const peakFrp = filteredFires.reduce((max, f) => Math.max(max, f.frp ?? 0), 0);

    return {
      total,
      highRisk,
      viirsCount,
      peakFrp: peakFrp > 0 ? `${peakFrp.toFixed(1)} MW` : "—",
    };
  }, [filteredFires]);

  const selectedObservation = useMemo(
    () => filteredFires.find((f) => f.id === selectedId) ?? null,
    [filteredFires, selectedId],
  );

  return (
    <AppShell
      title="Satellite Earth Observation"
      subtitle="Orbital thermal sensors (VIIRS & MODIS) tracking active surface fires and radiative power across monitored industrial sectors."
      actions={
        <div className="flex items-center gap-2">
          {isDemo ? (
            <DemoBadge
              text={isBackendConfigured ? "DEMO DATA" : "DEMO DATA — BACKEND OFFLINE"}
            />
          ) : null}
          <Button
            size="sm"
            variant="outline"
            onClick={fetchFires}
            disabled={isLoading}
            className="h-8 text-xs"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh Feed
          </Button>
        </div>
      }
    >
      {/* Top Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active Hotspots"
          value={stats.total}
          icon={Flame}
          tone="fire"
          hint={`${timeRangeHours}h observation window`}
        />
        <StatCard
          label="High Risk Hotspots"
          value={stats.highRisk}
          icon={ShieldAlert}
          tone="risk"
          hint="Within proximity to industrial assets"
        />
        <StatCard
          label="VIIRS Detections"
          value={stats.viirsCount}
          icon={Satellite}
          tone="accent"
          hint="High-resolution 375m imagery"
        />
        <StatCard
          label="Peak Fire Radiative Power"
          value={stats.peakFrp}
          icon={Zap}
          hint="Maximum detected radiative energy"
        />
      </div>

      {/* Sensor and Query Filters */}
      <div className="panel mt-6 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Sensor selector */}
            <div className="flex items-center gap-2">
              <span className="label-caps flex items-center gap-1">
                <Satellite className="size-3.5 text-accent" /> Sensor:
              </span>
              <div className="flex rounded-md border border-border bg-background p-0.5 text-xs">
                {["ALL", "VIIRS", "MODIS"].map((sensor) => (
                  <button
                    key={sensor}
                    type="button"
                    onClick={() => setSensorFilter(sensor)}
                    className={`rounded px-2.5 py-1 font-medium transition-colors ${
                      sensorFilter === sensor
                        ? "bg-surface font-semibold text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {sensor}
                  </button>
                ))}
              </div>
            </div>

            {/* Time range selector */}
            <div className="flex items-center gap-2">
              <span className="label-caps flex items-center gap-1">
                <Clock className="size-3.5 text-muted-foreground" /> Window:
              </span>
              <div className="flex rounded-md border border-border bg-background p-0.5 text-xs">
                {[24, 48, 72].map((hours) => (
                  <button
                    key={hours}
                    type="button"
                    onClick={() => setTimeRangeHours(hours)}
                    className={`rounded px-2.5 py-1 font-medium transition-colors ${
                      timeRangeHours === hours
                        ? "bg-surface font-semibold text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {hours}h
                  </button>
                ))}
              </div>
            </div>

            {/* Risk filter */}
            <div className="flex items-center gap-2">
              <span className="label-caps flex items-center gap-1">
                <Filter className="size-3.5 text-muted-foreground" /> Risk:
              </span>
              <div className="flex rounded-md border border-border bg-background p-0.5 text-xs">
                {["ALL", "HIGH", "MEDIUM", "LOW"].map((risk) => (
                  <button
                    key={risk}
                    type="button"
                    onClick={() => setRiskFilter(risk)}
                    className={`rounded px-2.5 py-1 font-medium transition-colors ${
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
            Showing <strong className="text-foreground">{filteredFires.length}</strong> thermal observations
          </div>
        </div>
      </div>

      {/* Map Section */}
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em]">Satellite Thermal Map</h2>
            <span className="text-xs text-muted-foreground">
              (Click any marker to inspect observation telemetry)
            </span>
          </div>
          {selectedObservation ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedId(null)}
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear Selection
            </Button>
          ) : null}
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8 xl:col-span-9">
            <ThermoMap
              markers={markers}
              selectedMarker={selectedId}
              onSelectMarker={setSelectedId}
              zoom={5}
              className="h-[28rem] w-full xl:h-[32rem]"
            />
          </div>

          {/* Selected Observation Telemetry Card */}
          <div className="lg:col-span-4 xl:col-span-3">
            {selectedObservation ? (
              <div className="panel flex h-full flex-col justify-between p-4">
                <div>
                  <div className="flex items-start justify-between gap-2 border-b border-border/80 pb-3">
                    <div>
                      <span className="label-caps">Telemetry Target</span>
                      <h3 className="font-semibold text-foreground">
                        {selectedObservation.type === "SMOKE" ? "💨 Smoke Plume" : "🔥 Thermal Hotspot"}
                      </h3>
                    </div>
                    <RiskBadge risk={selectedObservation.risk} />
                  </div>

                  <dl className="mt-3 space-y-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Coordinates</dt>
                      <dd className="font-mono text-foreground">
                        {selectedObservation.location.latitude.toFixed(4)},{" "}
                        {selectedObservation.location.longitude.toFixed(4)}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-muted-foreground">Satellite & Sensor</dt>
                      <dd className="font-mono text-foreground">
                        {selectedObservation.satellite ?? "ORBITAL"} · {selectedObservation.sensor ?? "VIIRS"}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-muted-foreground">Brightness Temperature</dt>
                      <dd className="font-mono text-foreground">
                        {selectedObservation.brightnessKelvin
                          ? `${selectedObservation.brightnessKelvin.toFixed(1)} K`
                          : "—"}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-muted-foreground">Fire Radiative Power (FRP)</dt>
                      <dd className="font-mono text-foreground">
                        {selectedObservation.frp ? `${selectedObservation.frp.toFixed(1)} MW` : "—"}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-muted-foreground">Confidence</dt>
                      <dd className="font-mono text-foreground">
                        {Math.round(selectedObservation.confidence * 100)}%
                      </dd>
                    </div>

                    <div>
                      <dt className="text-muted-foreground">Nearest Facility</dt>
                      <dd className="text-foreground">
                        {selectedObservation.nearestFacility?.name ?? "No nearby industrial asset"}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-muted-foreground">Detection Timestamp</dt>
                      <dd className="font-mono text-foreground">
                        {new Date(selectedObservation.detectedAt).toLocaleString()}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="mt-4 pt-3 border-t border-border">
                  <span className="block text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                    Prototype Risk Assessment
                  </span>
                </div>
              </div>
            ) : (
              <div className="panel flex h-full flex-col items-center justify-center p-6 text-center text-muted-foreground">
                <Satellite className="size-8 opacity-30" />
                <p className="mt-2 text-xs font-medium">Select a marker on the map or from the table below</p>
                <p className="mt-1 text-[0.7rem]">to inspect thermal characteristics and nearest facility details.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Observations Data Table */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em]">
            Observation Log ({filteredFires.length})
          </h2>
          {isDemo ? <DemoBadge text="DEMO DATA LOG" /> : null}
        </div>

        <div className="panel overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface/80 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider">Coordinates</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider">Satellite / Sensor</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider">Brightness (K)</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider">FRP (MW)</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider">Confidence</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider">Nearest Facility</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider">Prototype Risk</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider">Time</th>
                <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredFires.length > 0 ? (
                filteredFires.map((fire) => {
                  const isSelected = fire.id === selectedId;
                  return (
                    <tr
                      key={fire.id}
                      onClick={() => setSelectedId(fire.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-primary/10 hover:bg-primary/15"
                          : "hover:bg-surface/50"
                      }`}
                    >
                      <td className="px-4 py-3 font-medium">
                        <span className="flex items-center gap-1.5">
                          <span>{fire.type === "SMOKE" ? "💨" : "🔥"}</span>
                          <span>{fire.type}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {fire.location.latitude.toFixed(3)}, {fire.location.longitude.toFixed(3)}
                      </td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">
                        {fire.satellite ?? "VIIRS"} / {fire.sensor ?? "NPP"}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {fire.brightnessKelvin ? `${fire.brightnessKelvin.toFixed(1)} K` : "—"}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {fire.frp ? `${fire.frp.toFixed(1)} MW` : "—"}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {Math.round(fire.confidence * 100)}%
                      </td>
                      <td className="max-w-[12rem] truncate px-4 py-3">
                        {fire.nearestFacility?.name ? (
                          <span>
                            {fire.nearestFacility.name}{" "}
                            <span className="text-muted-foreground">
                              ({fire.nearestFacility.distanceKm?.toFixed(1)} km)
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <RiskBadge risk={fire.risk} />
                      </td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">
                        {new Date(fire.detectedAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant={isSelected ? "secondary" : "ghost"}
                          className="h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(fire.id);
                          }}
                        >
                          <MapPin className="size-3" /> Select
                        </Button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-muted-foreground">
                    No satellite thermal observations match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
