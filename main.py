from fastapi import FastAPI, UploadFile, File, Form, Query, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
from dotenv import load_dotenv
import tempfile
import os
import uuid
import math
import csv
import io
import requests
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

# Load environment variables from .env file
load_dotenv()

# Read environment variables
NASA_FIRMS_MAP_KEY = os.getenv("NASA_FIRMS_MAP_KEY", "5848f96987827148f9145834c8226d66").strip()
MODEL_PATH = os.getenv("MODEL_PATH", os.path.join(os.path.dirname(__file__), "best.pt"))

app = FastAPI(title="ThermoGuard AI API", version="1.0.0")


# Configure CORS to allow frontend communication (http://localhost:8081, http://localhost:8080, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Load trained YOLO model
model = YOLO(MODEL_PATH)


# Monitored industrial and emergency facilities
FACILITIES = [
    {
        "id": "fac-1",
        "name": "Demo Industrial Unit A",
        "type": "INDUSTRIAL",
        "location": {"latitude": 17.4102, "longitude": 78.5012},
    },
    {
        "id": "fac-2",
        "name": "Demo Chemical Storage B",
        "type": "INDUSTRIAL",
        "location": {"latitude": 17.3521, "longitude": 78.4321},
    },
    {
        "id": "fac-3",
        "name": "Demo Refinery Sector C",
        "type": "INDUSTRIAL",
        "location": {"latitude": 19.0821, "longitude": 72.8912},
    },
    {
        "id": "emg-1",
        "name": "Demo Emergency Response Centre 1",
        "type": "EMERGENCY",
        "location": {"latitude": 17.3902, "longitude": 78.4621},
    },
    {
        "id": "emg-2",
        "name": "Demo Emergency Response Centre 2",
        "type": "EMERGENCY",
        "location": {"latitude": 19.0621, "longitude": 72.8412},
    },
]


def calculate_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance formula in kilometers."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)


def get_nearest_facility(lat: float, lon: float) -> Optional[Dict[str, Any]]:
    """Find the nearest monitored facility and attach distance."""
    if not FACILITIES:
        return None
    nearest = min(
        FACILITIES,
        key=lambda f: calculate_distance_km(
            lat, lon, f["location"]["latitude"], f["location"]["longitude"]
        ),
    )
    dist = calculate_distance_km(
        lat, lon, nearest["location"]["latitude"], nearest["location"]["longitude"]
    )
    return {**nearest, "distanceKm": dist}


# In-memory stores for historical detections, satellite fires, and alerts
now = datetime.now(timezone.utc)
def hours_ago(h: float) -> str:
    return (now - timedelta(hours=h)).isoformat()


# Seed satellite fire observations
SATELLITE_FIRES: List[Dict[str, Any]] = [
    {
        "id": "sat-evt-1",
        "type": "FIRE",
        "confidence": 0.92,
        "detectedAt": hours_ago(1.2),
        "location": {"latitude": 17.385, "longitude": 78.4867, "label": "Hyderabad sector"},
        "nearestFacility": {**FACILITIES[0], "distanceKm": 3.4},
        "risk": "HIGH",
        "status": "New",
        "source": "SATELLITE",
        "satellite": "SUOMI-NPP",
        "sensor": "VIIRS",
        "brightnessKelvin": 342.1,
        "frp": 18.4,
    },
    {
        "id": "sat-evt-2",
        "type": "SMOKE",
        "confidence": 0.68,
        "detectedAt": hours_ago(3.5),
        "location": {"latitude": 19.076, "longitude": 72.8777, "label": "Mumbai sector"},
        "nearestFacility": {**FACILITIES[2], "distanceKm": 1.9},
        "risk": "MEDIUM",
        "status": "Acknowledged",
        "source": "SATELLITE",
        "satellite": "TERRA",
        "sensor": "MODIS",
        "brightnessKelvin": 318.7,
        "frp": 6.2,
    },
    {
        "id": "sat-evt-3",
        "type": "FIRE",
        "confidence": 0.79,
        "detectedAt": hours_ago(8.0),
        "location": {"latitude": 13.0827, "longitude": 80.2707, "label": "Chennai sector"},
        "nearestFacility": None,
        "risk": "MEDIUM",
        "status": "New",
        "source": "SATELLITE",
        "satellite": "NOAA-20",
        "sensor": "VIIRS",
        "brightnessKelvin": 325.4,
        "frp": 9.1,
    },
    {
        "id": "sat-evt-4",
        "type": "FIRE",
        "confidence": 0.45,
        "detectedAt": hours_ago(19.0),
        "location": {"latitude": 22.5726, "longitude": 88.3639, "label": "Kolkata sector"},
        "nearestFacility": {**FACILITIES[1], "distanceKm": 12.6},
        "risk": "LOW",
        "status": "Resolved",
        "source": "SATELLITE",
        "satellite": "AQUA",
        "sensor": "MODIS",
        "brightnessKelvin": 309.2,
        "frp": 2.8,
    },
    {
        "id": "sat-evt-5",
        "type": "SMOKE",
        "confidence": 0.84,
        "detectedAt": hours_ago(30.0),
        "location": {"latitude": 28.6139, "longitude": 77.209, "label": "Delhi sector"},
        "nearestFacility": {**FACILITIES[1], "distanceKm": 5.1},
        "risk": "HIGH",
        "status": "New",
        "source": "SATELLITE",
        "satellite": "SUOMI-NPP",
        "sensor": "VIIRS",
        "brightnessKelvin": 336.9,
        "frp": 14.7,
    },
]


ALERTS: List[Dict[str, Any]] = [
    {
        "id": "alert-1",
        "detectionType": "FIRE",
        "risk": "HIGH",
        "confidence": 0.92,
        "location": {"latitude": 17.385, "longitude": 78.4867, "label": "Hyderabad sector"},
        "nearestFacility": {**FACILITIES[0], "distanceKm": 3.4},
        "createdAt": hours_ago(1.2),
        "status": "New",
        "local": False,
    },
    {
        "id": "alert-2",
        "detectionType": "SMOKE",
        "risk": "MEDIUM",
        "confidence": 0.68,
        "location": {"latitude": 19.076, "longitude": 72.8777, "label": "Mumbai sector"},
        "nearestFacility": {**FACILITIES[2], "distanceKm": 1.9},
        "createdAt": hours_ago(3.5),
        "status": "Acknowledged",
        "local": False,
    },
    {
        "id": "alert-3",
        "detectionType": "FIRE",
        "risk": "HIGH",
        "confidence": 0.84,
        "location": {"latitude": 28.6139, "longitude": 77.209, "label": "Delhi sector"},
        "nearestFacility": {**FACILITIES[1], "distanceKm": 5.1},
        "createdAt": hours_ago(30.0),
        "status": "New",
        "local": False,
    },
    {
        "id": "alert-4",
        "detectionType": "FIRE",
        "risk": "LOW",
        "confidence": 0.45,
        "location": {"latitude": 22.5726, "longitude": 88.3639, "label": "Kolkata sector"},
        "nearestFacility": {**FACILITIES[1], "distanceKm": 12.6},
        "createdAt": hours_ago(19.0),
        "status": "Resolved",
        "local": False,
    },
]


DETECTION_HISTORY: List[Dict[str, Any]] = list(SATELLITE_FIRES) + [
    {
        "id": "hist-cam-1",
        "type": "FIRE",
        "confidence": 0.89,
        "detectedAt": hours_ago(48.0),
        "location": {"latitude": 12.9716, "longitude": 77.5946, "label": "Bengaluru sector"},
        "nearestFacility": {**FACILITIES[0], "distanceKm": 7.2},
        "risk": "HIGH",
        "status": "Resolved",
        "source": "AI_IMAGE",
        "boundingBox": {"x": 140, "y": 80, "width": 260, "height": 190},
    },
    {
        "id": "hist-cam-2",
        "type": "NONE",
        "confidence": 0.11,
        "detectedAt": hours_ago(60.0),
        "location": {"latitude": 23.0225, "longitude": 72.5714, "label": "Ahmedabad sector"},
        "nearestFacility": None,
        "risk": "LOW",
        "status": "Resolved",
        "source": "AI_IMAGE",
    },
    {
        "id": "hist-cam-3",
        "type": "SMOKE",
        "confidence": 0.62,
        "detectedAt": hours_ago(72.0),
        "location": {"latitude": 18.5204, "longitude": 73.8567, "label": "Pune sector"},
        "nearestFacility": {**FACILITIES[2], "distanceKm": 4.4},
        "risk": "MEDIUM",
        "status": "Acknowledged",
        "source": "AI_IMAGE",
        "boundingBox": {"x": 90, "y": 120, "width": 310, "height": 220},
    },
]


@app.get("/")
def root():
    return {
        "status": "online",
        "service": "ThermoGuard AI API",
        "nasa_firms_configured": bool(NASA_FIRMS_MAP_KEY),
        "endpoints": ["/analyze", "/fires", "/alerts", "/history", "/health"],
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model": "YOLO best.pt loaded",
        "classes": model.names,
        "nasa_firms_configured": bool(NASA_FIRMS_MAP_KEY),
    }


@app.post("/analyze")
async def analyze_image(
    file: UploadFile = File(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
):
    """Run YOLO inference on uploaded optical/thermal camera image."""
    suffix = os.path.splitext(file.filename or ".jpg")[1] or ".jpg"

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp:
        contents = await file.read()
        temp.write(contents)
        image_path = temp.name

    try:
        results = model.predict(source=image_path, conf=0.25, verbose=False)
        result = results[0]

        detections = []

        for box in result.boxes:
            class_id = int(box.cls[0])
            confidence = float(box.conf[0])
            class_name = result.names[class_id].upper()

            x1, y1, x2, y2 = box.xyxy[0].tolist()

            detection_type = (
                "FIRE"
                if "FIRE" in class_name
                else "SMOKE"
                if "SMOKE" in class_name
                else "NONE"
            )

            detections.append({
                "type": detection_type,
                "confidence": round(confidence, 4),
                "bounding_box": {
                    "x": round(x1, 2),
                    "y": round(y1, 2),
                    "width": round(x2 - x1, 2),
                    "height": round(y2 - y1, 2),
                },
            })

        # Strongest detection
        strongest = max(detections, key=lambda x: x["confidence"], default=None)

        if strongest is None:
            detection_type = "NONE"
            confidence = 0.0
            risk = "LOW"
            message = "No fire or smoke detected."
        else:
            detection_type = strongest["type"]
            confidence = strongest["confidence"]

            if detection_type == "FIRE" and confidence >= 0.70:
                risk = "HIGH"
            elif detection_type == "FIRE":
                risk = "MEDIUM"
            elif detection_type == "SMOKE" and confidence >= 0.60:
                risk = "MEDIUM"
            else:
                risk = "LOW"

            if detection_type == "FIRE":
                message = "Possible fire detected."
            elif detection_type == "SMOKE":
                message = "Smoke detected."
            else:
                message = "No fire detected."

        nearest_fac = get_nearest_facility(latitude, longitude)

        # Create frontend-compatible Detection object
        detection_record = {
            "id": f"det-{uuid.uuid4().hex[:8]}",
            "type": detection_type,
            "confidence": round(confidence, 4),
            "detectedAt": datetime.now(timezone.utc).isoformat(),
            "location": {
                "latitude": latitude,
                "longitude": longitude,
                "label": nearest_fac["name"] if nearest_fac else "Inspected Field Area",
            },
            "nearestFacility": nearest_fac,
            "risk": risk,
            "status": "New" if risk in ["HIGH", "MEDIUM"] else "Resolved",
            "source": "AI_IMAGE",
        }

        if strongest is not None:
            detection_record["boundingBox"] = strongest["bounding_box"]

        # Append to live detection history
        DETECTION_HISTORY.insert(0, detection_record)

        # If high risk or medium risk, auto-create alert
        if risk in ["HIGH", "MEDIUM"] and detection_type != "NONE":
            auto_alert = {
                "id": f"alert-{uuid.uuid4().hex[:8]}",
                "detectionType": detection_type,
                "risk": risk,
                "confidence": round(confidence, 4),
                "location": detection_record["location"],
                "nearestFacility": nearest_fac,
                "createdAt": detection_record["detectedAt"],
                "status": "New",
                "local": False,
            }
            ALERTS.insert(0, auto_alert)

        return {
            "detection": detection_record,
            "message": message,
        }

    finally:
        if os.path.exists(image_path):
            os.remove(image_path)


def fetch_nasa_firms_fires(sensor: Optional[str] = None) -> List[Dict[str, Any]]:
    """Fetch live hotspot data from NASA FIRMS API using NASA_FIRMS_MAP_KEY from .env if configured."""
    if not NASA_FIRMS_MAP_KEY:
        return []

    try:
        source = "VIIRS_SNPP_NRT"
        if sensor and sensor.upper() == "MODIS":
            source = "MODIS_NRT"
        elif sensor and sensor.upper() == "VIIRS":
            source = "VIIRS_SNPP_NRT"

        url = f"https://firms.modaps.eosdis.nasa.gov/api/country/csv/{NASA_FIRMS_MAP_KEY}/{source}/IND/1"
        res = requests.get(url, timeout=5)

        if res.status_code == 200 and "latitude" in res.text:
            reader = csv.DictReader(io.StringIO(res.text))
            nasa_events = []
            for i, row in enumerate(reader):
                if i >= 30:  # Top 30 active observations
                    break
                try:
                    lat = float(row.get("latitude", 0))
                    lon = float(row.get("longitude", 0))
                    frp = float(row.get("frp", 0)) if row.get("frp") else 10.0
                    brightness = float(row.get("bright_ti4", row.get("brightness", 320)))
                    conf_raw = str(row.get("confidence", "n")).lower()
                    conf = 0.85 if conf_raw in ["nominal", "n", "high", "h"] else 0.50

                    nearest_fac = get_nearest_facility(lat, lon)
                    risk = (
                        "HIGH"
                        if frp >= 15.0 or (nearest_fac and nearest_fac.get("distanceKm", 999) < 5.0)
                        else "MEDIUM"
                    )

                    nasa_events.append({
                        "id": f"nasa-{i + 1}",
                        "type": "FIRE",
                        "confidence": conf,
                        "detectedAt": datetime.now(timezone.utc).isoformat(),
                        "location": {
                            "latitude": lat,
                            "longitude": lon,
                            "label": nearest_fac["name"] if nearest_fac else "Satellite Hotspot",
                        },
                        "nearestFacility": nearest_fac,
                        "risk": risk,
                        "status": "New",
                        "source": "SATELLITE",
                        "satellite": row.get("satellite", "SNPP"),
                        "sensor": "VIIRS" if "VIIRS" in source else "MODIS",
                        "brightnessKelvin": brightness,
                        "frp": frp,
                    })
                except Exception:
                    continue

            if nasa_events:
                return nasa_events

    except Exception as e:
        print(f"[NASA FIRMS] Warning: could not fetch live satellite data ({e}), using default observations.")

    return []


@app.get("/fires")
def get_fires(
    hours: Optional[int] = Query(None, description="Time range in hours"),
    sensor: Optional[str] = Query(None, description="Sensor filter (VIIRS, MODIS)"),
):
    """Retrieve satellite-derived fire observations (using NASA FIRMS if key is active)."""
    live_fires = fetch_nasa_firms_fires(sensor=sensor)
    results = live_fires if live_fires else list(SATELLITE_FIRES)

    if sensor and sensor.upper() != "ALL":
        results = [
            f for f in results if f.get("sensor", "").upper() == sensor.upper()
        ]

    if hours is not None:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        results = [
            f
            for f in results
            if datetime.fromisoformat(f["detectedAt"]) >= cutoff
        ]

    return results


@app.get("/alerts")
def get_alerts():
    """Retrieve all operational incident alerts."""
    return ALERTS


@app.post("/alerts")
def create_alert(alert_data: Dict[str, Any] = Body(...)):
    """Create and broadcast a manual operator alert."""
    new_alert = {
        "id": f"alert-{uuid.uuid4().hex[:8]}",
        "detectionType": alert_data.get("detectionType", "FIRE"),
        "risk": alert_data.get("risk", "HIGH"),
        "confidence": float(alert_data.get("confidence", 0.90)),
        "location": alert_data.get("location", {"latitude": 17.385, "longitude": 78.4867}),
        "nearestFacility": alert_data.get("nearestFacility"),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "status": alert_data.get("status", "New"),
        "local": False,
    }
    ALERTS.insert(0, new_alert)
    return new_alert


@app.get("/history")
def get_history():
    """Retrieve audit history of AI detections and satellite observations."""
    return DETECTION_HISTORY