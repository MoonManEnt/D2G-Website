import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export const options = {
  stages: [
    { duration: "30s", target: 10 },
    { duration: "10s", target: 500 },   // SPIKE!
    { duration: "1m", target: 500 },
    { duration: "30s", target: 10 },    // Recovery
    { duration: "1m", target: 10 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<5000"],
    http_req_failed: ["rate<0.15"],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/health`);
  check(res, {
    "status is not 500": (r) => r.status !== 500,
  });
  sleep(0.3);
}
