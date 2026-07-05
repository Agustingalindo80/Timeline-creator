// ClickUp API client for pulling time entries. Backend-only: the ClickUp API
// token is read from the environment and never exposed to the frontend.

import type { ClickUpTimeEntry } from "./normalizeTimeEntry";

const CLICKUP_API_BASE_URL = "https://api.clickup.com/api/v2";

export interface ClickUpConfig {
  apiToken: string;
  teamId: string;
  assigneeIds: string[];
  spaceId?: string;
  folderId?: string;
  listId?: string;
}

// Read and validate ClickUp configuration from the environment. Throws a clear
// error when required variables are missing or when more than one location
// filter (space/folder/list) is set at once.
export function getClickUpConfig(): ClickUpConfig {
  const apiToken = process.env.CLICKUP_API_TOKEN?.trim();
  const teamId = process.env.CLICKUP_TEAM_ID?.trim();

  if (!apiToken) {
    throw new Error("CLICKUP_API_TOKEN is not set. Cannot call the ClickUp API.");
  }
  if (!teamId) {
    throw new Error("CLICKUP_TEAM_ID is not set. Cannot determine which ClickUp workspace to query.");
  }

  const assigneeIds = (process.env.CLICKUP_ASSIGNEE_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const spaceId = process.env.CLICKUP_SPACE_ID?.trim() || undefined;
  const folderId = process.env.CLICKUP_FOLDER_ID?.trim() || undefined;
  const listId = process.env.CLICKUP_LIST_ID?.trim() || undefined;

  const locationFilters = [
    spaceId ? "CLICKUP_SPACE_ID" : null,
    folderId ? "CLICKUP_FOLDER_ID" : null,
    listId ? "CLICKUP_LIST_ID" : null,
  ].filter((v): v is string => v !== null);

  if (locationFilters.length > 1) {
    throw new Error(
      `Only one ClickUp location filter may be configured at a time, but found: ${locationFilters.join(", ")}.`,
    );
  }

  return { apiToken, teamId, assigneeIds, spaceId, folderId, listId };
}

export interface FetchTimeEntriesParams {
  // Time window as Unix timestamps in milliseconds.
  startDate: number;
  endDate: number;
  // Optional override; defaults to getClickUpConfig().
  config?: ClickUpConfig;
}

// Fetch raw ClickUp time entries for the configured team within the given
// millisecond time window. Returns the raw entries array; normalization is a
// separate concern (see normalizeTimeEntry).
export async function fetchTimeEntries(
  params: FetchTimeEntriesParams,
): Promise<ClickUpTimeEntry[]> {
  const config = params.config ?? getClickUpConfig();

  const query = new URLSearchParams({
    start_date: String(params.startDate),
    end_date: String(params.endDate),
    include_task_tags: "true",
    include_location_names: "true",
    include_approval_details: "true",
  });

  if (config.assigneeIds.length > 0) {
    query.set("assignee", config.assigneeIds.join(","));
  }
  if (config.spaceId) {
    query.set("space_id", config.spaceId);
  } else if (config.folderId) {
    query.set("folder_id", config.folderId);
  } else if (config.listId) {
    query.set("list_id", config.listId);
  }

  const url = `${CLICKUP_API_BASE_URL}/team/${encodeURIComponent(config.teamId)}/time_entries?${query.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: config.apiToken,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `ClickUp API request failed (${response.status} ${response.statusText}): ${body.slice(0, 500)}`,
    );
  }

  const payload = (await response.json()) as { data?: ClickUpTimeEntry[] };
  return Array.isArray(payload.data) ? payload.data : [];
}
