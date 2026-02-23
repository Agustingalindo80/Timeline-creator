import { db } from "./db";
import { clients, timelines } from "@shared/schema";
import { eq, isNotNull } from "drizzle-orm";

export async function migrateClientsFromSettings() {
  const existingClients = await db.select().from(clients);
  if (existingClients.length > 0) return;

  const timelinesWithClient = await db
    .select()
    .from(timelines)
    .where(isNotNull(timelines.client));

  const clientValues = timelinesWithClient
    .map((t) => t.client)
    .filter((c): c is string => !!c && c.trim() !== "");

  const uniqueClientValues = Array.from(new Set(clientValues));

  if (uniqueClientValues.length === 0) return;

  const LABEL_MAP: Record<string, string> = {
    client_a: "Client A",
    client_b: "Client B",
  };

  for (const clientValue of uniqueClientValues) {
    const name = LABEL_MAP[clientValue] || clientValue.replace(/_/g, " ").replace(/\b\w/g, (ch: string) => ch.toUpperCase());

    const [created] = await db.insert(clients).values({ name }).returning();

    await db
      .update(timelines)
      .set({ clientId: created.id })
      .where(eq(timelines.client, clientValue));
  }

  console.log(`Migrated ${uniqueClientValues.length} client(s) from timeline data`);
}
