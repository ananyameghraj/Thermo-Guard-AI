import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Flame,
  Wind,
  Building2,
  Shield,
  Crosshair,
  BellRing,
  X,
  ExternalLink,
  Layers,
  Info,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ThermoMap } from "@/components/ThermoMap";
import { MapLegend } from "@/components/MapLegend";
import { DemoBadge } from "@/components/DemoBadge";
import { RiskBadge } from "@/components/RiskBadge";
import { Button } from "@/components/ui/button";
import { demoFacilities, demoFireEvents } from "@/data/demoData";
import { detectionToMarker, facilityToMarker } from "@/lib/markers";
import { getSatelliteFires, isBackendConfigured, DEMO_MODE } from "@/services/api";
import type { FireEvent, MapLayerKey, MapMarker } from "@/types";

export const Route = createFileRoute("/fire-map")({
  head: () => ({
    meta: [
      { title: "Live Fire Map — ThermoGuard AI Fire Intelligence" },
      {
        name: "description",
        content:
          "Geospatial situational awareness map showing active fires, smoke plumes, industrial facilities, and emergency response centers.",
      },
      { property: "og:title", content: "Live Fire Map — ThermoGuard AI" },
      {
        property: "og:description",
        content: "Interactive tactical map for industrial fire monitoring and emergency response.",
      },
    ],
  }),
  component: FireMapPage,
});

export default function FireMapPage() {
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [activeLayers, setActiveLayers] = useState<MapLayerKey[]>([
    "fire",
    "smoke",
    "facility",
    "emergency",
  ]);
  const [fires, setFires] = useState<FireEvent[]>([]);
  const [isDemo, setIsDemo] = useState<boolean>(!isBackendConfigured || DEMO_MODE);

  useEffect(() => {
    async function loadFires() {
      if (isBackendConfigured) {
        try {
          const data = await getSatelliteFires();
          setFires(data);
          setIsDemo(false);
          return;
        } catch (err) {
          console.warn("Failed to fetch fires from backend, using demo data:", err);
        }
      }
      setFires(demoFireEvents);
      setIsDemo(true);
    }
    loadFires();
  }, []);

  const handleToggleLayer = (key: MapLayerKey) => {
    setActiveLayers((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  // Convert fires & facilities to unified markers
  const markers = useMemo<MapMarker[]>(() => {
    const fireMarkers = fires.map(detectionToMarker);
    const facilityMarkers = demoFacilities.map(facilityToMarker);
    return [...fireMarkers, ...facilityMarkers];
  }, [fires]);

  // Selected marker object
  const selectedMarker = useMemo(
    () => markers.find((m) => m.id === selectedMarkerId) ?? null,
    [markers, selectedMarkerId],
  );

  // If selected marker is a fire or smoke event, find original detection
  const selectedFireEvent = useMemo(
    () => fires.find((f) => f.id === selectedMarkerId) ?? null,
    [fires, selectedMarkerId],
  );

  // If selected marker is a facility, find facility record
  const selectedFacility = useMemo(
    () => demoFacilities.find((f) => f.id === selectedMarkerId) ?? null,
    [selectedMarkerId],
  );

  return (
    <AppShell
      title="Tactical Situation Map"
      subtitle="Interactive multi-layer GIS overview correlating thermal hotspots, smoke drift, vulnerable industrial infrastructure, and emergency centers."
      actions={
        <div className="flex items-center gap-2">
          {isDemo ? (
            <DemoBadge text={isBackendConfigured ? "DEMO DATA" : "DEMO DATA — BACKEND OFFLINE"} />
          ) : null}
          <Button asChild size="sm" variant="secondary">
            <Link to="/satellite-monitoring">Satellite Telemetry</Link>
          </Button>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Main Map Canvas Column */}
        <div className="space-y-4 lg:col-span-8 xl:col-span-9">
          <div className="relative">
            <ThermoMap
              markers={markers}
              layers={activeLayers}
              selectedMarker={selectedMarkerId}
              onSelectMarker={setSelectedMarkerId}
              zoom={5}
              className="h-[32rem] w-full md:h-[42rem]"
            />

            {/* Floating Layer Filter */}
            <div className="absolute top-3 left-3 z-10">
              <MapLegend
                active={activeLayers}
                onToggle={handleToggleLayer}
                className="bg-card/90 shadow-xl backdrop-blur"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Info className="size-3.5" />
              <span>
                Displaying <strong>{markers.filter((m) => activeLayers.includes(m.kind)).length}</strong> active
                markers across {activeLayers.length} enabled layers.
              </span>
            </div>
            <span>Click any marker to inspect telemetry and facility risk.</span>
          </div>
        </div>

        {/* Side Panel Column: Selected Incident / Quick List */}
        <div className="space-y-5 lg:col-span-4 xl:col-span-3">
          {selectedMarker ? (
            <div className="panel p-5">
              <div className="flex items-start justify-between gap-3 border-b border-border/80 pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-lg border border-border bg-background/60 text-lg">
                    {selectedMarker.kind === "fire"
                      ? "🔥"
                      : selectedMarker.kind === "smoke"
                        ? "💨"
                        : selectedMarker.kind === "emergency"
                          ? "🚒"
                          : "🏭"}
                  </span>
                  <div>
                    <span className="label-caps">
                      {selectedMarker.kind === "fire"
                        ? "Fire Anomaly"
                        : selectedMarker.kind === "smoke"
                          ? "Smoke Plume"
                          : selectedMarker.kind === "emergency"
                            ? "Emergency Unit"
                            : "Industrial Asset"}
                    </span>
                    <h3 className="font-semibold text-foreground">{selectedMarker.title}</h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMarkerId(null)}
                  className="rounded p-1 text-muted-foreground hover:bg-surface hover:text-foreground"
                  aria-label="Close details"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Fire/Smoke Details */}
              {selectedFireEvent ? (
                <div className="mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Risk Level</span>
                    <RiskBadge risk={selectedFireEvent.risk} />
                  </div>

                  <dl className="space-y-2 text-xs">
                    <div className="flex justify-between border-b border-border/40 pb-1.5">
                      <dt className="text-muted-foreground">Coordinates</dt>
                      <dd className="font-mono text-foreground">
                        {selectedFireEvent.location.latitude.toFixed(4)},{" "}
                        {selectedFireEvent.location.longitude.toFixed(4)}
                      </dd>
                    </div>

                    <div className="flex justify-between border-b border-border/40 pb-1.5">
                      <dt className="text-muted-foreground">Detection Confidence</dt>
                      <dd className="font-mono text-foreground">
                        {Math.round(selectedFireEvent.confidence * 100)}%
                      </dd>
                    </div>

                    <div className="flex justify-between border-b border-border/40 pb-1.5">
                      <dt className="text-muted-foreground">Nearest Facility</dt>
                      <dd className="text-right text-foreground">
                        {selectedFireEvent.nearestFacility?.name ?? "—"}
                      </dd>
                    </div>

                    <div className="flex justify-between border-b border-border/40 pb-1.5">
                      <dt className="text-muted-foreground">Distance to Facility</dt>
                      <dd className="font-mono text-foreground">
                        {selectedFireEvent.nearestFacility?.distanceKm != null
                          ? `${selectedFireEvent.nearestFacility.distanceKm.toFixed(1)} km`
                          : "—"}
                      </dd>
                    </div>

                    {selectedFireEvent.brightnessKelvin ? (
                      <div className="flex justify-between border-b border-border/40 pb-1.5">
                        <dt className="text-muted-foreground">Brightness Temp</dt>
                        <dd className="font-mono text-foreground">
                          {selectedFireEvent.brightnessKelvin.toFixed(1)} K
                        </dd>
                      </div>
                    ) : null}

                    {selectedFireEvent.frp ? (
                      <div className="flex justify-between border-b border-border/40 pb-1.5">
                        <dt className="text-muted-foreground">Radiative Power (FRP)</dt>
                        <dd className="font-mono text-foreground">
                          {selectedFireEvent.frp.toFixed(1)} MW
                        </dd>
                      </div>
                    ) : null}

                    <div className="flex justify-between border-b border-border/40 pb-1.5">
                      <dt className="text-muted-foreground">Detected At</dt>
                      <dd className="font-mono text-foreground">
                        {new Date(selectedFireEvent.detectedAt).toLocaleString()}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-5 pt-2 flex flex-col gap-2">
                    <Button asChild size="sm" variant="secondary" className="w-full">
                      <Link to="/alerts">
                        <BellRing className="size-3.5" /> Check Alerts for Incident
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => setSelectedMarkerId(null)}
                    >
                      Clear Selection
                    </Button>
                  </div>
                </div>
              ) : null}

              {/* Facility Details */}
              {selectedFacility ? (
                <div className="mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Facility Type</span>
                    <span className="rounded border border-facility/40 bg-facility/10 px-2 py-0.5 text-[0.7rem] font-semibold text-facility">
                      {selectedFacility.type === "EMERGENCY"
                        ? "Emergency Response Centre"
                        : "Industrial Unit"}
                    </span>
                  </div>

                  <dl className="space-y-2 text-xs">
                    <div className="flex justify-between border-b border-border/40 pb-1.5">
                      <dt className="text-muted-foreground">Coordinates</dt>
                      <dd className="font-mono text-foreground">
                        {selectedFacility.location.latitude.toFixed(4)},{" "}
                        {selectedFacility.location.longitude.toFixed(4)}
                      </dd>
                    </div>
                    <div className="flex justify-between border-b border-border/40 pb-1.5">
                      <dt className="text-muted-foreground">Sector Reference</dt>
                      <dd className="font-mono text-foreground">{selectedFacility.id}</dd>
                    </div>
                  </dl>

                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => setSelectedMarkerId(null)}
                  >
                    Clear Selection
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            /* Quick Incident Directory When No Marker Selected */
            <div className="panel p-5">
              <span className="label-caps">Active Incident Directory</span>
              <p className="mt-1 text-xs text-muted-foreground">
                Select an active hotspot or response facility to spotlight its location.
              </p>

              <div className="mt-4 space-y-2 max-h-[22rem] overflow-y-auto pr-1">
                {fires.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedMarkerId(f.id)}
                    className="w-full text-left rounded-lg border border-border/80 bg-background/50 p-3 transition-colors hover:border-primary/40 hover:bg-surface"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span>{f.type === "SMOKE" ? "💨" : "🔥"}</span>
                        <span className="text-xs font-semibold text-foreground">
                          {f.location.label ?? `${f.type} Anomaly`}
                        </span>
                      </div>
                      <RiskBadge risk={f.risk} />
                    </div>
                    <div className="mt-2 flex justify-between text-[0.7rem] text-muted-foreground">
                      <span className="font-mono">
                        {f.location.latitude.toFixed(2)}, {f.location.longitude.toFixed(2)}
                      </span>
                      <span>{Math.round(f.confidence * 100)}% conf</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Infrastructure Section */}
              <div className="mt-5 border-t border-border pt-4">
                <span className="label-caps">Monitored Facilities</span>
                <div className="mt-3 space-y-1.5">
                  {demoFacilities.map((fac) => (
                    <button
                      key={fac.id}
                      type="button"
                      onClick={() => setSelectedMarkerId(fac.id)}
                      className="flex w-full items-center justify-between rounded-md border border-border/50 bg-background/30 px-3 py-2 text-xs transition-colors hover:bg-surface"
                    >
                      <span className="flex items-center gap-2">
                        <span>{fac.type === "EMERGENCY" ? "🚒" : "🏭"}</span>
                        <span className="truncate text-foreground">{fac.name}</span>
                      </span>
                      <span className="text-[0.65rem] font-mono text-muted-foreground">
                        {fac.type === "EMERGENCY" ? "EMG" : "IND"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
