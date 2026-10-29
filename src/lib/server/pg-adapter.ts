import pg from "pg";

/**
 * Compatibility adapter for the existing Neon SQL API.
 *
 * Hyperdrive supplies a PostgreSQL connection string and handles connection
 * pooling between Workers and Aiven. Each query/transaction uses a single
 * short-lived client; no connection stays pinned in a Worker isolate.
 *
 * Query arrays are lazy: tagged statements are not executed until awaited,
 * and sql.transaction() runs the entire array in one atomic transaction.
 */
type SqlRow = Record<string, unknown>;
type SqlParams = readonly unknown[];
type SqlExecute = (text: string, values: SqlParams) => Promise<SqlRow[]>;

// Preserve the existing HTTP database driver's ISO timestamp representation.
function normalizeRows(rows: SqlRow[]): SqlRow[] {
  return rows.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value]),
  ));
}

class RawFragment {
  readonly text: string;
  constructor(text: string) { this.text = text; }
}

export class PreparedSqlStatement implements PromiseLike<SqlRow[]> {
  readonly text: string;
  readonly values: SqlParams;
  private readonly execute: SqlExecute;
  constructor(text: string, values: SqlParams, execute: SqlExecute) {
    this.text = text;
    this.values = values;
    this.execute = execute;
  }

  then<TResult1 = SqlRow[], TResult2 = never>(
    onfulfilled?: ((value: SqlRow[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute(this.text, this.values).then(onfulfilled, onrejected);
  }
}

type AdapterSql = {
  (strings: TemplateStringsArray, ...values: unknown[]): PreparedSqlStatement;
  query(text: string, params?: unknown[]): Promise<SqlRow[]>;
  transaction(queries: PreparedSqlStatement[]): Promise<SqlRow[][]>;
  unsafe(text: string): RawFragment;
};

export function createPostgresSql(connectionString: string): AdapterSql {
  if (!connectionString) throw new Error("Aiven Hyperdrive connection string is missing");

  const run: SqlExecute = async (text, values) => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    try {
      const result = await client.query(text, [...values]);
      return normalizeRows(result.rows as SqlRow[]);
    } finally {
      await client.end();
    }
  };

  const tagged = ((strings: TemplateStringsArray, ...interpolations: unknown[]) => {
    let text = strings[0] ?? "";
    const values: unknown[] = [];
    for (const [i, interpolation] of interpolations.entries()) {
      if (interpolation instanceof RawFragment) {
        text += interpolation.text;
      } else {
        values.push(interpolation);
        text += "$" + values.length;
      }
      text += strings[i + 1] ?? "";
    }
    return new PreparedSqlStatement(text, values, run);
  }) as AdapterSql;

  tagged.query = (text, values) => run(text, values ?? []);
  tagged.unsafe = (text) => new RawFragment(text);

  tagged.transaction = async (statements) => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    try {
      await client.query("BEGIN");
      const rows: SqlRow[][] = [];
      for (const statement of statements) {
        if (!(statement instanceof PreparedSqlStatement)) {
          throw new Error("PostgreSQL transaction expects prepared SQL statements");
        }
        const result = await client.query(statement.text, [...statement.values]);
        rows.push(normalizeRows(result.rows as SqlRow[]));
      }
      await client.query("COMMIT");
      return rows;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Database transaction rollback failed", rollbackError);
      }
      throw error;
    } finally {
      await client.end();
    }
  };

  return tagged;
}
