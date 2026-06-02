import { query } from "../config/db";

export async function pingDatabase(): Promise<void> {
  await query("SELECT 1");
}
