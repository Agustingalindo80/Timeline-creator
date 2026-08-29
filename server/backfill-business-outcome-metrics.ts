import { db } from "./db";
import { sql } from "drizzle-orm";

const BACKFILL_LOCK_KEY = 4173829002;

/**
 * Preserves legacy outcome fields while giving each legacy outcome a first
 * structured metric. The NOT EXISTS guard makes this safe on every startup.
 */
export async function backfillBusinessOutcomeMetrics(): Promise<void> {
  let inserted = 0;
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${BACKFILL_LOCK_KEY})`);
    const result = await tx.execute(sql`
      INSERT INTO business_outcome_metrics (
        tenant_id, business_outcome_id, description,
        current_value, current_value_type, current_unit,
        expected_value, expected_value_type, expected_unit,
        evaluation_period, evaluation_period_unit, sort_order
      )
      SELECT
        o.tenant_id,
        o.id,
        COALESCE(NULLIF(btrim(o.success_metric), ''), o.title, 'Success metric'),
        values.current_number,
        CASE WHEN values.is_percentage THEN 'percentage'::business_outcome_metric_value_type ELSE 'quantity'::business_outcome_metric_value_type END,
        CASE WHEN values.is_percentage THEN '%' ELSE 'count' END,
        values.expected_number,
        CASE WHEN values.is_percentage THEN 'percentage'::business_outcome_metric_value_type ELSE 'quantity'::business_outcome_metric_value_type END,
        CASE WHEN values.is_percentage THEN '%' ELSE 'count' END,
        1, 'months'::business_outcome_metric_period_unit, 0
      FROM business_outcomes o
      CROSS JOIN LATERAL (
        SELECT
          btrim(COALESCE(o.current_value, '')) AS current_raw,
          btrim(COALESCE(o.baseline, '')) AS baseline_raw,
          btrim(COALESCE(o.target, '')) AS target_raw
      ) raw
      CROSS JOIN LATERAL (
        SELECT
          COALESCE(
            CASE WHEN raw.current_raw ~ '^[+]?[0-9]+([.][0-9]{1,4})?%?$'
              AND length(regexp_replace(split_part(ltrim(replace(raw.current_raw, '%', ''), '+'), '.', 1), '^0+', '')) <= 14
              THEN replace(raw.current_raw, '%', '')::numeric END,
            CASE WHEN raw.baseline_raw ~ '^[+]?[0-9]+([.][0-9]{1,4})?%?$'
              AND length(regexp_replace(split_part(ltrim(replace(raw.baseline_raw, '%', ''), '+'), '.', 1), '^0+', '')) <= 14
              THEN replace(raw.baseline_raw, '%', '')::numeric END
          ) AS current_number,
          COALESCE(
            CASE WHEN raw.target_raw ~ '^[+]?[0-9]+([.][0-9]{1,4})?%?$'
              AND length(regexp_replace(split_part(ltrim(replace(raw.target_raw, '%', ''), '+'), '.', 1), '^0+', '')) <= 14
              THEN replace(raw.target_raw, '%', '')::numeric END,
            CASE WHEN raw.current_raw ~ '^[+]?[0-9]+([.][0-9]{1,4})?%?$'
              AND length(regexp_replace(split_part(ltrim(replace(raw.current_raw, '%', ''), '+'), '.', 1), '^0+', '')) <= 14
              THEN replace(raw.current_raw, '%', '')::numeric END,
            CASE WHEN raw.baseline_raw ~ '^[+]?[0-9]+([.][0-9]{1,4})?%?$'
              AND length(regexp_replace(split_part(ltrim(replace(raw.baseline_raw, '%', ''), '+'), '.', 1), '^0+', '')) <= 14
              THEN replace(raw.baseline_raw, '%', '')::numeric END
          ) AS expected_number,
          position('%' in (COALESCE(o.success_metric, '') || COALESCE(o.current_value, '') || COALESCE(o.baseline, '') || COALESCE(o.target, ''))) > 0 AS is_percentage
      ) values
      WHERE values.current_number IS NOT NULL
        AND values.expected_number IS NOT NULL
        AND values.current_number >= 0
        AND values.expected_number >= 0
        AND (NOT values.is_percentage OR (values.current_number <= 100 AND values.expected_number <= 100))
        AND (o.success_metric IS NOT NULL OR o.current_value IS NOT NULL OR o.baseline IS NOT NULL OR o.target IS NOT NULL)
        AND NOT EXISTS (
          SELECT 1 FROM business_outcome_metrics m WHERE m.business_outcome_id = o.id
        )
    `);
    inserted = (result as any).rowCount ?? 0;
  });
  if (inserted > 0) console.log(`Business outcome metric backfill: created ${inserted} metric(s).`);
}