const secret = process.env.CRON_SECRET?.trim();

if (!secret) {
  console.error("[manual-model-review] CRON_SECRET is not configured in the Vercel build environment.");
  process.exit(1);
}

const endpoint = "https://wanhee-two.vercel.app/api/internal/model-catalog/sync";
const response = await fetch(endpoint, {
  method: "GET",
  headers: {
    authorization: `Bearer ${secret}`,
  },
  signal: AbortSignal.timeout(280_000),
});

const body = await response.text();
console.log(`[manual-model-review] HTTP ${response.status}`);
console.log(`[manual-model-review] ${body}`);

if (!response.ok) {
  process.exit(1);
}
