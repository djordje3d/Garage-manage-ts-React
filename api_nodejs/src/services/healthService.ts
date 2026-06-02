import * as healthRepo from "../repositories/healthRepository";

export async function checkHealth(): Promise<{ status: string; database: string }> {
  await healthRepo.pingDatabase();
  return { status: "ok", database: "connected" };
}
