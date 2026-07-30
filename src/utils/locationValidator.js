// ============================================================
//  AttendUCC — Location Validator
//  src/utils/locationValidator.js
// ============================================================

// ── UCC Campus Centre ──
export const UCC_CAMPUS = {
  lat: 5.1054,
  lng: -1.2766,
  name: "University of Cape Coast",
};

// ── Precise UCC Lecture Hall Locations ──
export const CLASSROOM_LOCATIONS = {
  "LT 1":             { lat: 5.1061, lng: -1.2771, radius: 80,  name: "Lecture Theatre 1"    },
  "LT 2":             { lat: 5.1058, lng: -1.2768, radius: 80,  name: "Lecture Theatre 2"    },
  "LT 3":             { lat: 5.1055, lng: -1.2764, radius: 80,  name: "Lecture Theatre 3"    },
  "LT 4":             { lat: 5.1052, lng: -1.2761, radius: 80,  name: "Lecture Theatre 4"    },
  "ICT Lab 1":        { lat: 5.1049, lng: -1.2759, radius: 60,  name: "ICT Computer Lab 1"   },
  "ICT Lab 2":        { lat: 5.1047, lng: -1.2757, radius: 60,  name: "ICT Computer Lab 2"   },
  "Science Theatre":  { lat: 5.1065, lng: -1.2775, radius: 100, name: "Science Theatre"      },
  "Main Auditorium":  { lat: 5.1070, lng: -1.2780, radius: 120, name: "Main Auditorium"      },
  "DEFAULT":          { lat: 5.1054, lng: -1.2766, radius: 200, name: "UCC Campus"            },
};

// Export as array for dropdowns
export const LECTURE_HALLS = Object.entries(CLASSROOM_LOCATIONS)
  .filter(([key]) => key !== "DEFAULT")
  .map(([key, val]) => ({
    id:     key,
    name:   val.name,
    lat:    val.lat,
    lng:    val.lng,
    radius: val.radius,
  }));

// ── Haversine distance formula ──
export function getDistanceMetres(lat1, lng1, lat2, lng2) {
  const R    = 6371000;
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
    name:     location.name,
  };
}

// ── Get student's current GPS position ──
// Indoors, a GPS satellite fix (enableHighAccuracy) often can't be acquired
// within a short timeout since concrete buildings block satellite signal —
// exactly the classroom scenario this app runs in. Try that first since it's
// more precise, but fall back to network/Wi-Fi based positioning (which
// works better indoors) instead of just failing outright.
function requestPosition(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat:      pos.coords.latitude,
        lng:      pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
      reject,
      options
    );
  });
}

export async function getCurrentPosition() {
  if (!navigator.geolocation) {
    throw new Error("Geolocation is not supported by your browser.");
  }

  try {
    return await requestPosition({ enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 });
  } catch (err) {
    if (err.code !== 3 /* TIMEOUT */) {
      const messages = {
        1: "Location permission was denied. Please allow location access and try again.",
        2: "Your location could not be determined. Make sure GPS is enabled.",
      };
      throw new Error(messages[err.code] || "Unknown location error.");
    }
  }

  try {
    return await requestPosition({ enableHighAccuracy: false, timeout: 15000, maximumAge: 15000 });
  } catch {
    throw new Error("Location request timed out. Please try again.");
  }
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

// ── Allowed campus network IP prefixes ──
export const ALLOWED_IP_PREFIXES = [
  // Campus network
  "192.168.", "10.", "172.",
  // MTN Ghana
  "154.160.", "154.161.", "154.162.", "154.163.",
  "41.190.", "41.191.",
  // Vodafone Ghana
  "196.46.", "41.189.", "196.223.",
  // AirtelTigo Ghana
  "41.194.", "197.255.", "41.204.",
  // Surfline / other Ghana ISPs
  "196.201.", "41.139.",
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
export async function validateAttendance(room = "DEFAULT", lecturerLat = null, lecturerLng = null) {
  const result = {
    gps:     { checked: false, allowed: false, error: null },
    ip:      { checked: false, allowed: false, error: null },
    overall: false,
  };

  // --- GPS check ---
  try {
    const pos = await getCurrentPosition();

    // If lecturer shared their location, use that instead of fixed classroom coords
    if (lecturerLat && lecturerLng) {
      const distance = getDistanceMetres(pos.lat, pos.lng, lecturerLat, lecturerLng);
      const allowed  = distance <= 100;
      result.gps = {
        checked:  true,
        allowed,
        distance: Math.round(distance),
        radius:   100,
        room:     room || "Lecturer Location",
        lat:      pos.lat,
        lng:      pos.lng,
        accuracy: pos.accuracy,
        error:    allowed ? null : `You are ${Math.round(distance)}m away from the lecturer. Must be within 100m.`,
      };
    } else {
      const fence = isInsideGeofence(pos.lat, pos.lng, room);
      result.gps = {
        checked:  true,
        allowed:  fence.allowed,
        distance: fence.distance,
        radius:   fence.radius,
        room:     fence.room,
        lat:      pos.lat,
        lng:      pos.lng,
        accuracy: pos.accuracy,
        error:    fence.allowed ? null : `You are ${fence.distance}m away from ${fence.name}. Must be within ${fence.radius}m.`,
      };
    }
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
  result.ip.address = result.ip.ip;
  return result;
}
