import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
    BellRing,
    CircleAlert,
    CheckCircle2,
    Clock,
    Plus,
    RefreshCw,
    Flame,
    Wind,
    ShieldCheck,
    ShieldAlert,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { AlertCard } from "@/components/AlertCard";
import { DemoBadge } from "@/components/DemoBadge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { demoAlerts, demoFacilities } from "@/data/demoData";
import { getAlerts, createAlert, isBackendConfigured, DEMO_MODE } from "@/services/api";
import type { Alert, AlertStatus, DetectionType, RiskLevel } from "@/types";

export const Route = createFileRoute("/alerts")({
    head: () => ({
        meta: [
            { title: "Alerts — ThermoGuard AI Fire Intelligence" },
            {
                name: "description",
                content: "Operational alert dispatch, triage, and resolution command center.",
            },
            { property: "og:title", content: "Alerts — ThermoGuard AI" },
            {
                property: "og:description",
                content: "Real-time industrial fire and smoke incident alerting system.",
            },
        ],
    }),
    component: AlertsPage,
});

function AlertsPage() {
    const navigate = useNavigate();
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [selectedStatus, setSelectedStatus] = useState<"ALL" | AlertStatus>("ALL");
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isDemo, setIsDemo] = useState<boolean>(!isBackendConfigured || DEMO_MODE);

    // Manual Alert Creation Modal
    const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
    const [newType, setNewType] = useState<DetectionType>("FIRE");
    const [newRisk, setNewRisk] = useState<RiskLevel>("HIGH");
    const [newLat, setNewLat] = useState<number>(17.385);
    const [newLon, setNewLon] = useState<number>(78.4867);
    const [newConfidence, setNewConfidence] = useState<number>(90);
    const [selectedFacilityId, setSelectedFacilityId] = useState<string>(demoFacilities[0].id);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    const fetchAlerts = async () => {
        setIsLoading(true);
        try {
            if (isBackendConfigured) {
                const data = await getAlerts();
                setAlerts(data);
                setIsDemo(false);
            } else {
                setAlerts(demoAlerts);
                setIsDemo(true);
            }
        } catch (err) {
            console.warn("Backend getAlerts failed, falling back to demo alerts:", err);
            setAlerts(demoAlerts);
            setIsDemo(true);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAlerts();
    }, []);

    const handleAcknowledge = async (id: string) => {
        setAlerts((prev) =>
            prev.map((a) => (a.id === id ? { ...a, status: "Acknowledged" as AlertStatus } : a)),
        );
    };

    const handleResolve = async (id: string) => {
        setAlerts((prev) =>
            prev.map((a) => (a.id === id ? { ...a, status: "Resolved" as AlertStatus } : a)),
        );
    };

    const handleViewOnMap = (alert: Alert) => {
        // Navigate to fire-map
        navigate({ to: "/fire-map" });
    };

    const handleCreateAlertSubmit = async () => {
        setIsSubmitting(true);
        const facility = demoFacilities.find((f) => f.id === selectedFacilityId) ?? null;

        const alertPayload: Partial<Alert> = {
            detectionType: newType,
            risk: newRisk,
            confidence: newConfidence / 100,
            location: {
                latitude: newLat,
                longitude: newLon,
                label: facility?.name ?? "Custom Alert Location",
            },
            nearestFacility: facility ? { ...facility, distanceKm: 1.8 } : null,
            createdAt: new Date().toISOString(),
            status: "New",
            local: !isBackendConfigured,
        };

        try {
            if (isBackendConfigured) {
                const created = await createAlert(alertPayload);
                setAlerts((prev) => [created, ...prev]);
            } else {
                const localCreated: Alert = {
                    id: `alert-loc-${Date.now().toString(36)}`,
                    detectionType: newType,
                    risk: newRisk,
                    confidence: newConfidence / 100,
                    location: {
                        latitude: newLat,
                        longitude: newLon,
                        label: facility?.name ?? "Manual Operator Alert",
                    },
                    nearestFacility: facility ? { ...facility, distanceKm: 1.8 } : null,
                    createdAt: new Date().toISOString(),
                    status: "New",
                    local: true,
                };
                setAlerts((prev) => [localCreated, ...prev]);
            }
            setIsDialogOpen(false);
        } catch (err) {
            console.error("Failed to create alert:", err);
            // Fallback local addition
            const localCreated: Alert = {
                id: `alert-loc-${Date.now().toString(36)}`,
                detectionType: newType,
                risk: newRisk,
                confidence: newConfidence / 100,
                location: {
                    latitude: newLat,
                    longitude: newLon,
                },
                nearestFacility: facility ? { ...facility, distanceKm: 1.8 } : null,
                createdAt: new Date().toISOString(),
                status: "New",
                local: true,
            };
            setAlerts((prev) => [localCreated, ...prev]);
            setIsDialogOpen(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Filtered alerts
    const filteredAlerts = useMemo(() => {
        if (selectedStatus === "ALL") return alerts;
        return alerts.filter((a) => a.status === selectedStatus);
    }, [alerts, selectedStatus]);

    // Statistics calculation
    const stats = useMemo(() => {
        const total = alerts.length;
        const newCount = alerts.filter((a) => a.status === "New").length;
        const ackCount = alerts.filter((a) => a.status === "Acknowledged").length;
        const resolvedCount = alerts.filter((a) => a.status === "Resolved").length;
        const highRisk = alerts.filter((a) => a.risk === "HIGH" && a.status !== "Resolved").length;

        return { total, newCount, ackCount, resolvedCount, highRisk };
    }, [alerts]);

    return (
        <AppShell
            title="Alert Dispatch & Triage"
            subtitle="Operational incident alerts requiring response, facility warning dissemination, and status tracking."
            actions={
                <div className="flex items-center gap-2">
                    {isDemo ? (
                        <DemoBadge text={isBackendConfigured ? "DEMO DATA" : "DEMO DATA — BACKEND OFFLINE"} />
                    ) : null}
                    <Button size="sm" variant="default" onClick={() => setIsDialogOpen(true)}>
                        <Plus className="size-3.5" /> Dispatch Alert
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={fetchAlerts}
                        disabled={isLoading}
                        className="h-8 text-xs"
                    >
                        <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
                    </Button>
                </div>
            }
        >
            {/* Stat Cards */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    label="Unresolved High-Risk"
                    value={stats.highRisk}
                    icon={ShieldAlert}
                    tone="risk"
                    hint="Requires urgent operator action"
                />
                <StatCard
                    label="New Alerts"
                    value={stats.newCount}
                    icon={CircleAlert}
                    tone="fire"
                    hint="Pending acknowledgment"
                />
                <StatCard
                    label="Acknowledged"
                    value={stats.ackCount}
                    icon={Clock}
                    tone="accent"
                    hint="Under investigation / response"
                />
                <StatCard
                    label="Resolved Incidents"
                    value={stats.resolvedCount}
                    icon={ShieldCheck}
                    tone="default"
                    hint="Mitigated or false alarm"
                />
            </div>

            {/* Filter Tabs */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3">
                <div className="flex flex-wrap items-center gap-2">
                    {(
                        [
                            { key: "ALL", label: "All Alerts", count: stats.total },
                            { key: "New", label: "New", count: stats.newCount },
                            { key: "Acknowledged", label: "Acknowledged", count: stats.ackCount },
                            { key: "Resolved", label: "Resolved", count: stats.resolvedCount },
                        ] as const
                    ).map((tab) => {
                        const isActive = selectedStatus === tab.key;
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setSelectedStatus(tab.key)}
                                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${isActive
                                    ? "bg-surface text-foreground border border-primary/40 shadow-sm"
                                    : "text-muted-foreground hover:bg-surface/50 hover:text-foreground"
                                    }`}
                            >
                                <span>{tab.label}</span>
                                <span
                                    className={`rounded-full px-1.5 py-0.2 text-[0.65rem] font-mono ${isActive
                                        ? "bg-primary/20 text-primary"
                                        : "bg-background/80 text-muted-foreground"
                                        }`}
                                >
                                    {tab.count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="text-xs text-muted-foreground">
                    Showing <strong>{filteredAlerts.length}</strong> alerts in current view
                </div>
            </div>

            {/* Alert Cards List */}
            <div className="mt-6 space-y-4">
                {filteredAlerts.length > 0 ? (
                    filteredAlerts.map((alert) => (
                        <AlertCard
                            key={alert.id}
                            alert={alert}
                            onAcknowledge={handleAcknowledge}
                            onResolve={handleResolve}
                            onViewOnMap={handleViewOnMap}
                        />
                    ))
                ) : (
                    /* Empty State */
                    <div className="panel flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                        <div className="grid size-12 place-items-center rounded-full border border-border bg-background/50">
                            <CheckCircle2 className="size-6 text-risk-low" />
                        </div>
                        <h3 className="mt-4 font-semibold text-foreground">No Alerts in this Category</h3>
                        <p className="mt-1 max-w-sm text-xs">
                            There are currently no {selectedStatus !== "ALL" ? `"${selectedStatus}"` : ""} alerts logged in the system.
                        </p>
                        {selectedStatus !== "ALL" ? (
                            <Button
                                size="sm"
                                variant="outline"
                                className="mt-4 text-xs"
                                onClick={() => setSelectedStatus("ALL")}
                            >
                                View All Alerts
                            </Button>
                        ) : null}
                    </div>
                )}
            </div>

            {/* Manual Alert Creation Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-md bg-card border-border text-foreground">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base">
                            <BellRing className="size-4 text-primary" /> Dispatch Manual Incident Alert
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Broadcast an operational alert to ground response and notify industrial sector units.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2 text-xs">
                        {/* Type selector */}
                        <div>
                            <Label className="text-xs">Incident Hazard Type</Label>
                            <div className="mt-1 flex gap-2">
                                {(["FIRE", "SMOKE"] as const).map((type) => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setNewType(type)}
                                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border p-2 text-xs font-semibold transition-colors ${newType === type
                                            ? "border-primary bg-primary/20 text-foreground"
                                            : "border-border bg-background/50 text-muted-foreground hover:bg-surface"
                                            }`}
                                    >
                                        {type === "FIRE" ? <Flame className="size-3.5 text-fire" /> : <Wind className="size-3.5 text-smoke" />}
                                        <span>{type}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Risk Level */}
                        <div>
                            <Label className="text-xs">Prototype Risk Level</Label>
                            <div className="mt-1 flex gap-2">
                                {(["HIGH", "MEDIUM", "LOW"] as const).map((risk) => (
                                    <button
                                        key={risk}
                                        type="button"
                                        onClick={() => setNewRisk(risk)}
                                        className={`flex-1 rounded-md border p-2 text-xs font-semibold transition-colors ${newRisk === risk
                                            ? risk === "HIGH"
                                                ? "border-risk-high bg-risk-high/20 text-risk-high"
                                                : risk === "MEDIUM"
                                                    ? "border-risk-medium bg-risk-medium/20 text-risk-medium"
                                                    : "border-risk-low bg-risk-low/20 text-risk-low"
                                            : "border-border bg-background/50 text-muted-foreground hover:bg-surface"
                                            }`}
                                    >
                                        {risk}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Nearest Facility */}
                        <div>
                            <Label htmlFor="facility-select" className="text-xs">
                                Associated Facility
                            </Label>
                            <select
                                id="facility-select"
                                value={selectedFacilityId}
                                onChange={(e) => {
                                    setSelectedFacilityId(e.target.value);
                                    const fac = demoFacilities.find((f) => f.id === e.target.value);
                                    if (fac) {
                                        setNewLat(fac.location.latitude);
                                        setNewLon(fac.location.longitude);
                                    }
                                }}
                                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                                {demoFacilities.map((fac) => (
                                    <option key={fac.id} value={fac.id} className="bg-card text-foreground">
                                        {fac.name} ({fac.type})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Coordinates */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label htmlFor="lat" className="text-xs">
                                    Latitude
                                </Label>
                                <Input
                                    id="lat"
                                    type="number"
                                    step="0.0001"
                                    value={newLat}
                                    onChange={(e) => setNewLat(parseFloat(e.target.value) || 0)}
                                    className="mt-1 font-mono text-xs"
                                />
                            </div>
                            <div>
                                <Label htmlFor="lon" className="text-xs">
                                    Longitude
                                </Label>
                                <Input
                                    id="lon"
                                    type="number"
                                    step="0.0001"
                                    value={newLon}
                                    onChange={(e) => setNewLon(parseFloat(e.target.value) || 0)}
                                    className="mt-1 font-mono text-xs"
                                />
                            </div>
                        </div>

                        {/* Confidence */}
                        <div>
                            <div className="flex justify-between">
                                <Label htmlFor="confidence" className="text-xs">
                                    Confidence Score
                                </Label>
                                <span className="font-mono text-xs font-semibold text-foreground">{newConfidence}%</span>
                            </div>
                            <Input
                                id="confidence"
                                type="range"
                                min="30"
                                max="100"
                                value={newConfidence}
                                onChange={(e) => setNewConfidence(parseInt(e.target.value, 10))}
                                className="mt-1 cursor-pointer"
                            />
                        </div>
                    </div>

                    <DialogFooter className="mt-2">
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setIsDialogOpen(false)}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            variant="default"
                            onClick={handleCreateAlertSubmit}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Dispatching..." : "Dispatch Alert"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppShell>
    );
}
