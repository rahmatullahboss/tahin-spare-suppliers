const DEFAULT_VERIFICATION_MAX_AGE_DAYS = 30;

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function brandKey(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const BRAND_ALIASES: Record<string, string> = {
  "cat": "Caterpillar",
  "caterpillar": "Caterpillar",
  "caterpillar-cat": "Caterpillar",
  "caterpiller": "Caterpillar",
  "yamnar": "Yanmar",
  "yanmar": "Yanmar",
  "yanmar-diesel": "Yanmar",
  "man-b-and-w": "MAN B&W",
  "man-b-and-w-diesel": "MAN B&W",
  "man-b-and-w-diesel-augsburg-germany": "MAN B&W",
  "daihatsu": "Daihatsu",
  "daitshu": "Daihatsu",
  "diatshu": "Daihatsu",
  "macgregor": "MacGregor",
  "mcgregor": "MacGregor",
  "cummins": "Cummins",
  "cummins-engine-co-ltd-great-britain": "Cummins",
  "mitsubishi-heavy-industries-ltd-japan": "Mitsubishi",
  "mitsubishi-uec": "Mitsubishi",
  "ihi-corporation-japan": "IHI",
  "ishikawajima-harima-heavy-industries-co-ltd-ihi-japan": "IHI",
  "bbc-brown-boveri": "BBC (Brown Boveri)",
  "bbc-brown-boveri-switzerland": "BBC (Brown Boveri)",
  "hagglunds-drives-sweden": "Hägglunds",
  "hagglunds-drives-ab-sweden": "Hägglunds",
  "sulzer": "Sulzer",
};

export function canonicalizeBrand(value: unknown): string {
  const cleaned = cleanText(value);
  if (!cleaned) return "";
  return BRAND_ALIASES[brandKey(cleaned)] ?? cleaned;
}

export function cleanProductTitle(value: unknown): string {
  let cleaned = cleanText(value);
  if (!cleaned) return "";

  cleaned = cleaned.replace(/^\[(?:update|updated)\s*\d{1,4}\]\s*/i, "");
  cleaned = cleaned.replace(/\s*(?:[-–—|]\s*)?(?:update|updated)\s*\d{1,4}\s*$/i, "");
  return cleanText(cleaned);
}

export function normalizeVerificationDate(value: unknown): string {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  }

  const cleaned = cleanText(value);
  if (!cleaned) return "";

  const match = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return "";
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function inventoryVerificationMaxAgeDays(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(cleanText(value), 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 365) return DEFAULT_VERIFICATION_MAX_AGE_DAYS;
  return Math.floor(parsed);
}

type AvailabilityResolutionInput = {
  availability?: string;
  verifiedAt?: string;
  now?: Date;
  maxAgeDays?: number;
};

export type PublicAvailability = {
  label: string;
  fresh: boolean;
  positive: boolean;
  verifiedAt: string;
};

export function resolvePublicAvailability({
  availability,
  verifiedAt,
  now = new Date(),
  maxAgeDays = DEFAULT_VERIFICATION_MAX_AGE_DAYS,
}: AvailabilityResolutionInput): PublicAvailability {
  const raw = cleanText(availability);
  const verifiedDate = normalizeVerificationDate(verifiedAt);
  const safeMaxAgeDays = inventoryVerificationMaxAgeDays(maxAgeDays);

  if (!raw) {
    return {
      label: "Contact to confirm current availability",
      fresh: false,
      positive: false,
      verifiedAt: verifiedDate,
    };
  }

  const terminalUnavailable = /\b(sold|out of stock|unavailable|not available|discontinued)\b/i.test(raw);
  if (terminalUnavailable) {
    return { label: raw, fresh: true, positive: false, verifiedAt: verifiedDate };
  }

  const freshnessSensitive = /\b(verified|in stock|available|ready)\b/i.test(raw);
  if (!freshnessSensitive) {
    return { label: raw, fresh: false, positive: false, verifiedAt: verifiedDate };
  }

  if (!verifiedDate || Number.isNaN(now.getTime())) {
    return {
      label: "Contact to confirm current availability",
      fresh: false,
      positive: false,
      verifiedAt: verifiedDate,
    };
  }

  const verifiedMs = Date.parse(`${verifiedDate}T00:00:00Z`);
  const ageMs = now.getTime() - verifiedMs;
  const maxAgeMs = safeMaxAgeDays * 24 * 60 * 60 * 1000;
  const isFresh = ageMs >= 0 && ageMs <= maxAgeMs;

  if (!isFresh) {
    return {
      label: "Contact to confirm current availability",
      fresh: false,
      positive: false,
      verifiedAt: verifiedDate,
    };
  }

  return {
    label: /\b(verified|in stock)\b/i.test(raw) ? "Verified in Stock" : raw,
    fresh: true,
    positive: true,
    verifiedAt: verifiedDate,
  };
}
