import http from "k6/http";
import { check, sleep, group } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const AUTH_TOKEN = __ENV.AUTH_TOKEN || "";

export const options = {
  stages: [
    { duration: "2m", target: 30 },   // Ramp up to 30 users (beta)
    { duration: "5m", target: 30 },   // Stay at 30 users
    { duration: "2m", target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<1000", "p(99)<2000"],
    http_req_failed: ["rate<0.05"],
    "group_duration{group:::API Health}": ["avg<200"],
    "group_duration{group:::Client List}": ["avg<1000"],
    "group_duration{group:::Dispute List}": ["avg<1000"],
  },
};

const headers = {
  "Content-Type": "application/json",
  Authorization: AUTH_TOKEN ? `Bearer ${AUTH_TOKEN}` : "",
};

export default function () {
  group("API Health", () => {
    const res = http.get(`${BASE_URL}/api/health`);
    check(res, { "health ok": (r) => r.status === 200 });
  });

  group("Client List", () => {
    const res = http.get(`${BASE_URL}/api/clients`, { headers });
    check(res, {
      "clients status 200 or 401": (r) => [200, 401].includes(r.status),
      "clients response time < 1s": (r) => r.timings.duration < 1000,
    });
  });

  group("Dispute List", () => {
    const res = http.get(`${BASE_URL}/api/disputes`, { headers });
    check(res, {
      "disputes status 200 or 401": (r) => [200, 401].includes(r.status),
      "disputes response time < 1s": (r) => r.timings.duration < 1000,
    });
  });

  group("Analytics", () => {
    const res = http.get(`${BASE_URL}/api/analytics`, { headers });
    check(res, {
      "analytics status 200 or 401": (r) => [200, 401].includes(r.status),
    });
  });

  sleep(Math.random() * 3 + 1); // 1-4 second think time
}
