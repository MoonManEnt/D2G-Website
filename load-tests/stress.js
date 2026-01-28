import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export const options = {
  stages: [
    { duration: "1m", target: 50 },
    { duration: "3m", target: 100 },
    { duration: "3m", target: 200 },
    { duration: "3m", target: 300 },
    { duration: "2m", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<3000"],
    http_req_failed: ["rate<0.10"],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/health`);
  check(res, {
    "status is 200": (r) => r.status === 200,
    "response time < 3s": (r) => r.timings.duration < 3000,
  });
  sleep(0.5);
}
