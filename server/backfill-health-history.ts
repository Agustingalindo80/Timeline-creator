import { db } from "./db";
import { sql } from "drizzle-orm";

const BACKFILL_LOCK_KEY = 4173829001;

export async function backfillHealthHistory(): Promise<void> {
  let inserted = 0;
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${BACKFILL_LOCK_KEY})`);
    const result = await tx.execute(sql`
      INSERT INTO timeline_health_history (tenant_id, timeline_id, health_overall, scope_health, budget_health, team_health, recorded_at)
      SELECT t.tenant_id, t.id, t.health_overall, t.scope_health, t.budget_health, t.team_health, COALESCE(t.created_at, now())
      FROM timelines t
      WHERE t.record_type = 'project'
        AND NOT EXISTS (
          SELECT 1 FROM timeline_health_history h WHERE h.timeline_id = t.id
        )
    `);
    inserted = (result as any).rowCount ?? 0;
  });
  if (inserted > 0) {
    console.log(`Health history backfill: created ${inserted} baseline record(s).`);
  }
}
