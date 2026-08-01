// ============================================================
//  AttendUCC — API Connection Utility
//  src/api.js
// ============================================================

import { getCurrentPosition } from "./utils/locationValidator";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

function getToken() {
  return localStorage.getItem("attenducc_token");
}

// A random ID persisted per browser/device (survives login/logout, unlike
// the auth token) — lets the backend tell "one phone scanning for several
// accounts" apart from "several phones on the same WiFi", which a shared
// public IP can't distinguish.
function getDeviceId() {
  let id = localStorage.getItem("attenducc_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("attenducc_device_id", id);
  }
  return id;
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization:  `Bearer ${getToken()}`,
  };
}

let sessionExpiredHandled = false;

async function handleResponse(res) {
  // A 401 on a request that carried a token means the session itself is
  // dead (expired/invalid), not a rejected value — e.g. a wrong password
  // on /auth/login is also a 401, but that request never carries a token.
  // Without this, an expired session just leaves the user stuck looking
  // logged in with every page silently failing to load.
  if (res.status === 401 && getToken() && !sessionExpiredHandled) {
    sessionExpiredHandled = true;
    localStorage.removeItem("attenducc_token");
    localStorage.removeItem("attenducc_user");
    alert("Your session has expired. Please log in again.");
    window.location.reload();
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

// ══════════════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════════════

export async function login(identifier, password, role) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ identifier, password, role }),
  });
  const data = await handleResponse(res);
  localStorage.setItem("attenducc_token", data.token);
  localStorage.setItem("attenducc_user",  JSON.stringify(data.user));
  return data.user;
}

export async function register(formData) {
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(formData),
  });
  return handleResponse(res);
}

export function logout() {
  localStorage.removeItem("attenducc_token");
  localStorage.removeItem("attenducc_user");
}

export function getSavedUser() {
  const user = localStorage.getItem("attenducc_user");
  return user ? JSON.parse(user) : null;
}

// ══════════════════════════════════════════════════════
//  LECTURE HALLS
// ══════════════════════════════════════════════════════

export async function getLectureHalls() {
  const res = await fetch(`${BASE_URL}/halls`);
  return handleResponse(res);
}

// ══════════════════════════════════════════════════════
//  COURSES
// ══════════════════════════════════════════════════════

export async function getCourses() {
  const res = await fetch(`${BASE_URL}/courses`, { headers: authHeaders() });
  return handleResponse(res);
}

export async function addCourse(name, code) {
  const res = await fetch(`${BASE_URL}/courses`, {
    method:  "POST",
    headers: authHeaders(),
    body:    JSON.stringify({ name, code }),
  });
  return handleResponse(res);
}

// ══════════════════════════════════════════════════════
//  SESSIONS
// ══════════════════════════════════════════════════════

export async function getTodaySessions() {
  const res = await fetch(`${BASE_URL}/sessions/today`, { headers: authHeaders() });
  return handleResponse(res);
}

export async function createSession(course_id, room) {
  const res = await fetch(`${BASE_URL}/sessions`, {
    method:  "POST",
    headers: authHeaders(),
    body:    JSON.stringify({ course_id, room }),
  });
  return handleResponse(res);
}

export async function generateQR(sessionId) {
  // Capture lecturer's GPS location when generating QR
  let lecturer_lat = null;
  let lecturer_lng = null;
  try {
    const pos = await getCurrentPosition();
    lecturer_lat = pos.lat;
    lecturer_lng = pos.lng;
  } catch {
    // GPS unavailable — proceed without location, backend falls back to the room's fixed coords
  }

  const res = await fetch(`${BASE_URL}/sessions/${sessionId}/qr`, {
    method:  "POST",
    headers: authHeaders(),
    body:    JSON.stringify({ lecturer_lat, lecturer_lng }),
  });
  return handleResponse(res);
}

export async function endSession(sessionId) {
  const res = await fetch(`${BASE_URL}/sessions/${sessionId}/end`, {
    method:  "POST",
    headers: authHeaders(),
  });
  return handleResponse(res);
}

// ══════════════════════════════════════════════════════
//  ATTENDANCE
// ══════════════════════════════════════════════════════

export async function scanAttendance(qr_token, gps_lat, gps_lng, ip_address) {
  const res = await fetch(`${BASE_URL}/attendance/scan`, {
    method:  "POST",
    headers: authHeaders(),
    body:    JSON.stringify({ qr_token, gps_lat, gps_lng, ip_address, device_id: getDeviceId() }),
  });
  return handleResponse(res);
}

export async function getSessionAttendance(sessionId) {
  const res = await fetch(`${BASE_URL}/attendance/session/${sessionId}`, { headers: authHeaders() });
  return handleResponse(res);
}

export async function getStudentAttendance() {
  const res = await fetch(`${BASE_URL}/attendance/student`, { headers: authHeaders() });
  return handleResponse(res);
}

export async function getCourseReport(courseId) {
  const res = await fetch(`${BASE_URL}/attendance/course/${courseId}`, { headers: authHeaders() });
  return handleResponse(res);
}
