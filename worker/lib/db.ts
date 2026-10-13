import { Client, type QueryResultRow } from "pg";
export class DB {
  constructor(
    readonly client: {
      query: (
        text: string,
        values: unknown[],
      ) => Promise<{ rows: QueryResultRow[] }>;
      end: () => Promise<void>;
    },
  ) {}
  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values: unknown[] = [],
  ): Promise<T[]> {
    return (await this.client.query(text, values)).rows as T[];
  }
  async tx<T>(fn: (db: DB) => Promise<T>): Promise<T> {
    await this.query("BEGIN");
    try {
      const result = await fn(this);
      await this.query("COMMIT");
      return result;
    } catch (e) {
      await this.query("ROLLBACK");
      throw e;
    }
  }
}
export async function connect(connectionString: string) {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 5000,
    query_timeout: 10000,
  });
  await client.connect();
  return new DB(client);
}
