export const UCC_CAMPUS = {
  lat: 5.1054,
  lng: -1.2766,
  name: "University of Cape Coast",
};
export const CLASSROOM_LOCATIONS = {
  "LT 1":      { lat: 5.1061, lng: -1.2771, radius: 80  }, // 80 metres
  "LT 2":      { lat: 5.1058, lng: -1.2768, radius: 80  },
  "LT 3":      { lat: 5.1055, lng: -1.2764, radius: 80  },
  "ICT Lab 2": { lat: 5.1049, lng: -1.2759, radius: 60  }, // tighter for labs
  "DEFAULT":   { lat: 5.1054, lng: -1.2766, radius: 200 }, // fallback = whole campus
};

export function getDistanceMetres(lat1, lng1, lat2, lng2) {
  const R    = 6371000; // Earth radius in metres
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Check if student is inside the classroom geofence ──
export function isInsideGeofence(studentLat, studentLng, room) {
  const location = CLASSROOM_LOCATIONS[room] || CLASSROOM_LOCATIONS["DEFAULT"];
  const distance = getDistanceMetres(studentLat, studentLng, location.lat, location.lng);
  return {
    allowed:  distance <= location.radius,
    distance: Math.round(distance),
    radius:   location.radius,
    room,
  };
}

// ── Get student's current GPS position ──
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => {
        const messages = {
          1: "Location permission was denied. Please allow location access and try again.",
          2: "Your location could not be determined. Make sure GPS is enabled.",
          3: "Location request timed out. Please try again.",
        };
        reject(new Error(messages[err.code] || "Unknown location error."));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

// ── Fetch the device's public IP address ──
export async function getPublicIP() {
  try {
    const res  = await fetch("https://api.ipify.org?format=json");
    const data = await res.json();
    return data.ip;
  } catch {
    return null;
  }
}

export const ALLOWED_IP_PREFIXES = [
  // Campus network
  "192.168.",   // Campus LAN
  "10.",        // Campus intranet / VPN
  "172.",       // Private network

  // MTN Ghana
  "154.160.",
  "41.190.",
  "41.191.",

  // Vodafone Ghana
  "196.46.",
  "41.189.",
  "196.223.",

  // AirtelTigo Ghana
  "41.194.",
  "197.255.",
  "41.204.",

  // Surfline / other Ghana ISPs
  "196.201.",
  "41.139.",
];

export function isAllowedIP(ip) {
  if (!ip) return { allowed: false, ip: "unknown", reason: "Could not detect your IP address." };
  const allowed = ALLOWED_IP_PREFIXES.some((prefix) => ip.startsWith(prefix));
  return {
    allowed,
    ip,
    reason: allowed
      ? `Connected via campus network (${ip})`
      : `Your network (${ip}) is not recognised as a UCC campus network.`,
  };
}

// ── Master validation — runs GPS + IP together ──
export async function validateAttendance(room = "DEFAULT") {
  const result = {
    gps:     { checked: false, allowed: false, error: null },
    ip:      { checked: false, allowed: false, error: null },
    overall: false,
  };

  // --- GPS check ---
  try {
    const pos      = await getCurrentPosition();
    const fence    = isInsideGeofence(pos.lat, pos.lng, room);
    result.gps = {
      checked:  true,
      allowed:  fence.allowed,
      distance: fence.distance,
      radius:   fence.radius,
      room:     fence.room,
      lat:      pos.lat,
      lng:      pos.lng,
      accuracy: pos.accuracy,
      error:    fence.allowed ? null : `You are ${fence.distance}m away from ${room}. Must be within ${fence.radius}m.`,
    };
  } catch (err) {
    result.gps = { checked: true, allowed: false, error: err.message };
  }

  // --- IP check ---
  try {
    const ip      = await getPublicIP();
    const ipCheck = isAllowedIP(ip);
    result.ip = {
      checked: true,
      allowed: ipCheck.allowed,
      ip:      ipCheck.ip,
      reason:  ipCheck.reason,
      error:   ipCheck.allowed ? null : ipCheck.reason,
    };
  } catch (err) {
    result.ip = { checked: true, allowed: false, error: "IP check failed." };
  }

  result.overall = true; // TESTING ONLY — remove before real campus use
result.ip.address = result.ip.ip; // expose IP for backend submission
return result;
}
