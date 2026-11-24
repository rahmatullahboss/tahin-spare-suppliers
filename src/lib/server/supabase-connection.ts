/** A guarded, opt-in connection to Tahin's existing Supabase database. */
const TAHIN_SUPABASE_REF = "xpfowzrwjbojbgtekoim";
const TAHIN_BACKEND_ROLE = `tahin_worker.${TAHIN_SUPABASE_REF}`;

export type SupabaseConnectionEnv = {
  SUPABASE_DATABASE_URL?: string;
  SUPABASE_HYPERDRIVE?: { connectionString: string };
};

export type SupabaseConnection = { connectionString: string; requireTls: boolean };

// Fixed, safe messages only: never include any portion of the supplied URI.
export class SupabaseConfigurationError extends Error {}

export function resolveSupabaseConnection(env: SupabaseConnectionEnv): SupabaseConnection {
  if (env.SUPABASE_DATABASE_URL) {
    let parsed: URL;
    try {
      parsed = new URL(env.SUPABASE_DATABASE_URL.trim());
    } catch {
      throw new SupabaseConfigurationError("Invalid URI format; paste only the full connection string");
    }

    // Validate each field separately without echoing sensitive values.
    if (!["postgres:", "postgresql:"].includes(parsed.protocol)) throw new SupabaseConfigurationError("URI must start with postgresql://");
    if (!parsed.hostname.endsWith(".pooler.supabase.com")) throw new SupabaseConfigurationError("Wrong pooler hostname");
    if (!["6543", "5432"].includes(parsed.port)) throw new SupabaseConfigurationError("Wrong pooler port; use 6543 or 5432");
    let username: string;
    let password: string;
    try {
      username = decodeURIComponent(parsed.username);
      password = decodeURIComponent(parsed.password);
    } catch {
      throw new SupabaseConfigurationError("Invalid percent encoding in username or password");
    }
    if (username !== TAHIN_BACKEND_ROLE) throw new SupabaseConfigurationError("Wrong username; use tahin_worker with the project suffix");
    if (!password) throw new SupabaseConfigurationError("Password missing");
    if (/^\[(?:YOUR[-_ ]DATABASE[-_ ]PASSWORD|NEW[-_ ]PASSWORD)\]$/i.test(password)) throw new SupabaseConfigurationError("Password placeholder was not replaced");
    if (parsed.pathname !== "/postgres") throw new SupabaseConfigurationError("Wrong database path; use /postgres");
    if (parsed.hash) throw new SupabaseConfigurationError("Unexpected URI fragment; percent-encode special password characters");

    const mode = parsed.searchParams.get("sslmode");
    if (mode && !["require", "verify-ca", "verify-full"].includes(mode)) {
      throw new SupabaseConfigurationError("SSL mode must require TLS");
    }
    for (const key of parsed.searchParams.keys()) {
      if (key !== "sslmode") throw new SupabaseConfigurationError("Unexpected connection option; use only sslmode=require");
    }
    // node-postgres can override SSL client options from sslmode in a URL.
    // Set verified TLS directly on the pg.Client instead.
    parsed.searchParams.delete("sslmode");
    return { connectionString: parsed.toString(), requireTls: true };
  }

  // Optional legacy preview Hyperdrive path, never mandatory for Supavisor.
  if (env.SUPABASE_HYPERDRIVE?.connectionString) {
    return { connectionString: env.SUPABASE_HYPERDRIVE.connectionString, requireTls: false };
  }
  throw new SupabaseConfigurationError("SUPABASE_DATABASE_URL is missing from the active Preview runtime");
}
