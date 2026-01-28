# Load Testing with k6

## Installation
```bash
brew install k6
```

## Running Tests
```bash
k6 run load-tests/smoke.js         # Quick sanity check
k6 run load-tests/average-load.js  # Normal traffic simulation
k6 run load-tests/stress.js        # Stress test to find limits
k6 run load-tests/spike.js         # Sudden traffic spike
```

## Environment Variables

- `BASE_URL` - The base URL of the application (default: `http://localhost:3000`)
- `AUTH_TOKEN` - Bearer token for authenticated endpoints (optional)

### Example with environment variables:
```bash
k6 run -e BASE_URL=https://staging.dispute2go.com -e AUTH_TOKEN=your-token load-tests/average-load.js
```

## Test Descriptions

### smoke.js
Quick sanity check with 1 virtual user for 30 seconds. Validates that the health endpoint responds within 200ms. Use this after deployments to verify basic functionality.

### average-load.js
Simulates normal traffic with up to 30 concurrent users over ~9 minutes. Tests API health, client list, dispute list, and analytics endpoints. Thresholds ensure 95th percentile response times stay under 1 second.

### stress.js
Gradually increases load from 50 to 300 virtual users over ~12 minutes to find the application's breaking point. Use this to identify performance degradation thresholds.

### spike.js
Simulates a sudden traffic spike from 10 to 500 virtual users. Tests the application's ability to handle sudden surges and recover gracefully. Useful for evaluating auto-scaling behavior.
