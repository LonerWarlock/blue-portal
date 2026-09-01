import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';

const baseUrl = String(__ENV.BASE_URL || 'http://localhost:3005').replace(/\/$/, '');
const scenario = String(__ENV.SCENARIO || 'baseline');

const profiles = {
  baseline: [
    { duration: '5m', target: 1000 },
    { duration: '15m', target: 1000 },
    { duration: '3m', target: 0 },
  ],
  surge: [
    { duration: '8m', target: 5000 },
    { duration: '10m', target: 5000 },
    { duration: '5m', target: 0 },
  ],
  spike: [
    { duration: '2m', target: 7500 },
    { duration: '2m', target: 7500 },
    { duration: '5m', target: 0 },
  ],
};

export const options = {
  scenarios: {
    campaign: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: profiles[scenario] || profiles.baseline,
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
  },
};

const cachedPages = ['/', '/pricing', '/product/agents', '/docs', '/blog'];

export default function () {
  // Deterministic distribution approximates the campaign mix without sending
  // OTPs, payments, contact email, or paid provider requests.
  const slot = exec.scenario.iterationInTest % 100;
  const target = slot < 85
    ? cachedPages[slot % cachedPages.length]
    : slot < 95 ? '/api/models?catalog=public' : '/api/health';
  const response = http.get(`${baseUrl}${target}`, {
    tags: { route: target.split('?')[0], scenario },
    timeout: '10s',
  });
  check(response, {
    'status is controlled': value => value.status >= 200 && value.status < 500,
  });
  sleep(1);
}
