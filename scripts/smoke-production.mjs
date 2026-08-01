const baseUrl = (process.env.SMOKE_BASE_URL || "https://tahinspare.com").replace(/\/$/, "");
const attempts = Number.parseInt(process.env.SMOKE_ATTEMPTS || "6", 10);
const delayMs = Number.parseInt(process.env.SMOKE_DELAY_MS || "3000", 10);

const checks = [
  {
    path: "/",
    validate: (html) => /TAHIN SPARE SUPPLIERS/i.test(html),
    description: "homepage brand content",
  },
  {
    path: "/category/spare-parts",
    validate: (html) => (html.match(/class=\"product-card\"/g) || []).length > 0,
    description: "Spare Parts product cards",
  },
  {
    path: "/category/diesel-generator-set",
    validate: (html) => (html.match(/class=\"product-card\"/g) || []).length > 0,
    description: "Diesel & Gas Generator Set product cards",
  },
];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function checkWithRetry(check) {
  let lastError = "unknown failure";

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}${check.path}`, {
        redirect: "follow",
        signal: AbortSignal.timeout(10_000),
      });
      const html = await response.text();

      if (response.ok && check.validate(html)) {
        console.log(`PASS ${check.path} (${response.status}) — ${check.description}`);
        return;
      }

      lastError = `HTTP ${response.status}; expected ${check.description}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    if (attempt < attempts) {
      console.warn(`RETRY ${check.path} ${attempt}/${attempts}: ${lastError}`);
      await wait(delayMs);
    }
  }

  throw new Error(`Smoke check failed for ${check.path}: ${lastError}`);
}

for (const check of checks) {
  await checkWithRetry(check);
}

console.log(`Production smoke checks passed for ${baseUrl}`);
