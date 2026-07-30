// ============================================================
//  AttendUCC — Location Validator
//  src/utils/locationValidator.js
// ============================================================

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
        1: "Location permission was denied. Enable location access for this site in your browser settings, then try again.",
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
