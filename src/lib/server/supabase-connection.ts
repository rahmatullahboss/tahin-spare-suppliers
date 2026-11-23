/** A guarded, opt-in connection to Tahin's existing Supabase database. */
const TAHIN_SUPABASE_REF = "xpfowzrwjbojbgtekoim";
const TAHIN_BACKEND_ROLE = `tahin_worker.${TAHIN_SUPABASE_REF}`;

export type SupabaseConnectionEnv = {
  SUPABASE_DATABASE_URL?: string;
  SUPABASE_HYPERDRIVE?: { connectionString: string };
};

export type SupabaseConnection = { connectionString: string; requireTls: boolean };

export function resolveSupabaseConnection(env: SupabaseConnectionEnv): SupabaseConnection {
  if (env.SUPABASE_DATABASE_URL) {
    let parsed: URL;
    try {
      parsed = new URL(env.SUPABASE_DATABASE_URL);
    } catch {
      throw new Error("Invalid Supabase database URL");
    }

    // An accidental provider switch must never connect to a different database
    // or elevate to the Postgres owner role (which bypasses row-level security).
    if (!["postgres:", "postgresql:"].includes(parsed.protocol) ||
        !parsed.hostname.endsWith(".pooler.supabase.com") ||
        !["6543", "5432"].includes(parsed.port) ||
        decodeURIComponent(parsed.username) !== TAHIN_BACKEND_ROLE ||
        !parsed.password || parsed.pathname !== "/postgres") {
      throw new Error("Supabase connection must use Tahin's private worker role and shared pooler");
    }

    const mode = parsed.searchParams.get("sslmode");
    if (mode && !["require", "verify-ca", "verify-full"].includes(mode)) {
      throw new Error("Supabase direct connection must enforce TLS");
    }
    if (["sslcert", "sslkey", "sslrootcert"].some((key) => parsed.searchParams.has(key))) {
      throw new Error("Supabase TLS certificates must not be passed through the connection URL");
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
  throw new Error("Supabase selected, but SUPABASE_DATABASE_URL secret is unavailable");
}
