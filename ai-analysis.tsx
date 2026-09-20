import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useId, type ChangeEvent, type DragEvent } from "react";
import {
  UploadCloud,
  FileImage,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  MapPin,
  Flame,
  CheckCircle2,
  Navigation,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DetectionResultCard } from "@/components/DetectionResultCard";
import { DemoBadge } from "@/components/DemoBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { analyzeImage, isBackendConfigured, DEMO_MODE } from "@/services/api";
import { demoFacilities } from "@/data/demoData";
import type { Detection } from "@/types";

export const Route = createFileRoute("/ai-analysis")({
  head: () => ({
    meta: [
      { title: "AI Analysis — ThermoGuard AI Fire Intelligence" },
      {
        name: "description",
        content: "Run AI fire and smoke computer vision analysis on drone, CCTV, or thermal imagery.",
      },
      { property: "og:title", content: "AI Analysis — ThermoGuard AI Fire Intelligence" },
      {
        property: "og:description",
        content: "High-precision AI computer vision detection for thermal and optical imagery.",
      },
    ],
  }),
  component: AiAnalysisPage,
});

const defaultFacility = demoFacilities[0]!;

const LOCATION_PRESETS = [
  { name: "Hyderabad Sector (Industrial Unit A)", lat: 17.385, lon: 78.4867, facility: demoFacilities[0]! },
  { name: "Mumbai Sector (Refinery C)", lat: 19.076, lon: 72.8777, facility: demoFacilities[2]! },
  { name: "Chennai Sector", lat: 13.0827, lon: 80.2707, facility: null },
  { name: "Delhi Sector (Chemical Storage B)", lat: 28.6139, lon: 77.209, facility: demoFacilities[1]! },
];

function AiAnalysisPage() {
  const fileInputId = useId();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [latitude, setLatitude] = useState<number>(17.385);
  const [longitude, setLongitude] = useState<number>(78.4867);
  const [selectedPreset, setSelectedPreset] = useState<string>(LOCATION_PRESETS[0]!.name);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<Detection | null>(null);
  const [isDemoResult, setIsDemoResult] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (file: File) => {
    setSelectedFile(file);
    setErrorMessage(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileChange(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      handleFileChange(file);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleSelectPreset = (name: string) => {
    setSelectedPreset(name);
    const preset = LOCATION_PRESETS.find((p) => p.name === name);
    if (preset) {
      setLatitude(preset.lat);
      setLongitude(preset.lon);
    }
  };

  const runAnalysis = async () => {
    if (!selectedFile) {
      setErrorMessage("Please upload an image for AI detection.");
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      if (isBackendConfigured) {
        const res = await analyzeImage(selectedFile, latitude, longitude);
        setResult(res.detection);
        setIsDemoResult(false);
      } else {
        // Backend not configured: simulate AI inference with demo response
        await new Promise((resolve) => setTimeout(resolve, 1400));
        const currentPreset = LOCATION_PRESETS.find((p) => p.name === selectedPreset);

        const simulatedDetection: Detection = {
          id: `ai-det-${Date.now().toString(36)}`,
          type: "FIRE",
          confidence: 0.94,
          detectedAt: new Date().toISOString(),
          location: {
            latitude,
            longitude,
            label: currentPreset?.name ?? "Field Inspection Site",
          },
          nearestFacility: currentPreset?.facility
            ? { ...currentPreset.facility, distanceKm: 2.1 }
            : { ...defaultFacility, distanceKm: 4.8 },
          risk: "HIGH",
          status: "New",
          source: "AI_IMAGE",
          boundingBox: {
            x: 120,
            y: 84,
            width: 310,
            height: 240,
          },
        };

        setResult(simulatedDetection);
        setIsDemoResult(true);
      }
    } catch (err: unknown) {
      console.error("AI Analysis error:", err);
      // Fallback demo inference on connection failure
      const currentPreset = LOCATION_PRESETS.find((p) => p.name === selectedPreset);
      const simulatedDetection: Detection = {
        id: `ai-det-${Date.now().toString(36)}`,
        type: "FIRE",
        confidence: 0.89,
        detectedAt: new Date().toISOString(),
        location: {
          latitude,
          longitude,
          label: currentPreset?.name ?? "Field Inspection Site",
        },
        nearestFacility: currentPreset?.facility
          ? { ...currentPreset.facility, distanceKm: 3.2 }
          : { ...defaultFacility, distanceKm: 5.1 },
        risk: "HIGH",
        status: "New",
        source: "AI_IMAGE",
        boundingBox: {
          x: 140,
          y: 90,
          width: 280,
          height: 210,
        },
      };
      setResult(simulatedDetection);
      setIsDemoResult(true);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUseSampleImage = async () => {
    // Generate an in-memory sample canvas image for immediate demo testing
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // Dark command center thermal background gradient
      const grad = ctx.createLinearGradient(0, 0, 640, 480);
      grad.addColorStop(0, "#121420");
      grad.addColorStop(0.5, "#1f2438");
      grad.addColorStop(1, "#0a0c14");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 640, 480);

      // Industrial structure outline
      ctx.strokeStyle = "#38425d";
      ctx.lineWidth = 3;
      ctx.strokeRect(100, 180, 240, 220);
      ctx.strokeRect(360, 220, 200, 180);

      // Thermal hotspot / flame flare
      const flameGrad = ctx.createRadialGradient(220, 280, 10, 220, 280, 120);
      flameGrad.addColorStop(0, "#ffffff");
      flameGrad.addColorStop(0.2, "#ffbf00");
      flameGrad.addColorStop(0.6, "#ff3b00");
      flameGrad.addColorStop(1, "transparent");
      ctx.fillStyle = flameGrad;
      ctx.beginPath();
      ctx.arc(220, 280, 120, 0, Math.PI * 2);
      ctx.fill();

      // Label text
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px monospace";
      ctx.fillText("THERMAL CAM CH-04 [SIMULATION]", 20, 35);
      ctx.fillStyle = "#ff4444";
      ctx.fillText("HOTSPOT ALERT: 342.1K", 20, 65);

      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], "thermal_inspection_frame_04.jpg", {
            type: "image/jpeg",
          });
          handleFileChange(file);
        }
      }, "image/jpeg");
    }
  };

  return (
    <AppShell
      title="AI Image Analysis"
      subtitle="Analyze thermal or optical imagery for fire, smoke, and industrial thermal anomalies using neural vision models."
      actions={
        <Button size="sm" variant="outline" onClick={handleUseSampleImage}>
          <Sparkles className="size-3.5" /> Load Sample Thermal Image
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Upload & Coordinates */}
        <div className="space-y-5 lg:col-span-6 xl:col-span-7">
          {/* Dropzone & Preview */}
          <div className="panel p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="label-caps">Target Imagery Input</span>
              {previewUrl ? (
                <span className="flex items-center gap-1 text-xs text-risk-low">
                  <CheckCircle2 className="size-3.5" /> Image Loaded
                </span>
              ) : null}
            </div>

            <input
              id={fileInputId}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleInputChange}
            />

            {previewUrl ? (
              <div className="relative overflow-hidden rounded-lg border border-border bg-black/40">
                <img
                  src={previewUrl}
                  alt="Target preview"
                  className="max-h-80 w-full object-contain"
                />
                {result?.boundingBox ? (
                  <div
                    className="absolute border-2 border-fire bg-fire/20 shadow-[0_0_15px_rgba(255,100,0,0.5)]"
                    style={{
                      left: "18%",
                      top: "22%",
                      width: "48%",
                      height: "50%",
                    }}
                  >
                    <span className="absolute -top-6 left-0 rounded bg-fire px-1.5 py-0.5 font-mono text-[0.65rem] font-bold uppercase text-white shadow">
                      {result.type} ({Math.round(result.confidence * 100)}%)
                    </span>
                  </div>
                ) : null}

                <div className="flex items-center justify-between border-t border-border bg-surface/90 px-3 py-2 text-xs">
                  <span className="truncate font-mono text-muted-foreground">
                    {selectedFile?.name} ({(selectedFile ? selectedFile.size / 1024 : 0).toFixed(1)} KB)
                  </span>
                  <label
                    htmlFor={fileInputId}
                    className="cursor-pointer text-primary hover:underline"
                  >
                    Change Image
                  </label>
                </div>
              </div>
            ) : (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                  isDragging
                    ? "border-primary bg-primary/10"
                    : "border-border/80 bg-surface/40 hover:border-border hover:bg-surface/70"
                }`}
              >
                <div className="grid size-12 place-items-center rounded-full border border-border bg-background">
                  <UploadCloud className="size-6 text-muted-foreground" />
                </div>
                <p className="mt-3 text-sm font-semibold">
                  Drag and drop thermal or optical drone footage
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Supports JPEG, PNG, WEBP, or radiometric TIFF frames
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <label htmlFor={fileInputId}>
                    <Button asChild size="sm" variant="secondary" className="cursor-pointer">
                      <span>
                        <FileImage className="size-3.5" /> Select Image
                      </span>
                    </Button>
                  </label>
                  <Button size="sm" variant="ghost" onClick={handleUseSampleImage}>
                    Try with Sample
                  </Button>
                </div>
              </div>
            )}

            {errorMessage ? (
              <div className="mt-3 flex items-center gap-2 rounded border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            ) : null}
          </div>

          {/* Coordinates & Location Inputs */}
          <div className="panel p-5">
            <span className="label-caps">Geographic Coordinates</span>
            <p className="mt-1 text-xs text-muted-foreground">
              Provide capture coordinates to associate detection with nearby industrial infrastructure.
            </p>

            {/* Quick Sector Presets */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {LOCATION_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => handleSelectPreset(p.name)}
                  className={`rounded border px-2.5 py-1 text-xs transition-colors ${
                    selectedPreset === p.name
                      ? "border-primary bg-primary/15 font-semibold text-foreground"
                      : "border-border bg-background/50 text-muted-foreground hover:bg-surface"
                  }`}
                >
                  {p.name.split(" ")[0]}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="latitude" className="text-xs">
                  Latitude
                </Label>
                <div className="relative mt-1">
                  <Input
                    id="latitude"
                    type="number"
                    step="0.0001"
                    value={latitude}
                    onChange={(e) => {
                      setLatitude(parseFloat(e.target.value) || 0);
                      setSelectedPreset("");
                    }}
                    className="font-mono text-xs"
                  />
                  <Navigation className="absolute right-2.5 top-2.5 size-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <div>
                <Label htmlFor="longitude" className="text-xs">
                  Longitude
                </Label>
                <div className="relative mt-1">
                  <Input
                    id="longitude"
                    type="number"
                    step="0.0001"
                    value={longitude}
                    onChange={(e) => {
                      setLongitude(parseFloat(e.target.value) || 0);
                      setSelectedPreset("");
                    }}
                    className="font-mono text-xs"
                  />
                  <Navigation className="absolute right-2.5 top-2.5 size-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>

            <Button
              size="lg"
              className="mt-5 w-full font-semibold uppercase tracking-wider"
              onClick={runAnalysis}
              disabled={isAnalyzing || !selectedFile}
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="size-4 animate-spin" /> Analyzing Image...
                </>
              ) : (
                <>
                  <Flame className="size-4" /> Run AI Detection
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Right Column: AI Analysis Result */}
        <div className="space-y-5 lg:col-span-6 xl:col-span-5">
          <div className="flex items-center justify-between">
            <span className="label-caps">Inference Output</span>
            {isDemoResult || (!isBackendConfigured && DEMO_MODE) ? (
              <DemoBadge text={isBackendConfigured ? "Demo simulation" : "Demo data — backend not connected"} />
            ) : null}
          </div>

          {result ? (
            <div className="space-y-4">
              <DetectionResultCard detection={result} />

              <div className="panel p-4">
                <span className="label-caps">Operational Actions</span>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="secondary">
                    <Link to="/fire-map">
                      <MapPin className="size-3.5" /> View on Live Map
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/alerts">
                      <Flame className="size-3.5" /> Dispatch Alert
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="panel flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
              <div className="grid size-12 place-items-center rounded-lg border border-border bg-background/50">
                <Sparkles className="size-6 opacity-40" />
              </div>
              <p className="mt-4 font-semibold text-foreground">No Analysis Executed</p>
              <p className="mt-1 max-w-xs text-xs">
                Upload an image and run detection to inspect model confidence, bounding boxes, and prototype risk.
              </p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
