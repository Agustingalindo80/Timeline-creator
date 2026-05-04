import OpenAI from "openai";
import { storage } from "../storage";
import { getFileMetadata, getFileContent } from "../google-drive";

interface VerificationResultItem {
  checkpointId: string;
  checkpointName: string;
  verified: boolean;
  summary: string;
}

interface VerificationResult {
  verified: number;
  total: number;
  withArtifacts: number;
  results: VerificationResultItem[];
}

export async function verifyArtifacts(
  timelineId: string,
  stageId: string,
  tenantId: string
): Promise<VerificationResult> {
  const timeline = await storage.getTimeline(timelineId, tenantId);
  if (!timeline) throw Object.assign(new Error("Timeline not found"), { statusCode: 404 });

  const checkpoints = await storage.getProjectCheckpointsByStage(timelineId, stageId, tenantId);
  const checkpointsWithArtifacts = checkpoints.filter(c => c.artifactFileId || c.artifactUrl || c.artifactFileName);

  if (checkpointsWithArtifacts.length === 0) {
    return { verified: 0, total: checkpoints.length, withArtifacts: 0, results: [] };
  }

  const stage = await storage.getFlightpathStage(stageId, tenantId);
  const deliverables = await storage.getStageDeliverables(stageId, tenantId);

  const openai = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });

  const results: VerificationResultItem[] = [];

  for (const cp of checkpointsWithArtifacts) {
    let fileContent: string | null = null;
    let fileMetadata: any = null;

    if (timeline.docRepositoryType === "google_drive") {
      const fId = cp.artifactFileId || null;
      if (fId) {
        try {
          fileMetadata = await getFileMetadata(fId);
          fileContent = await getFileContent(fId, fileMetadata.mimeType);
        } catch (e) {
          console.error(`Failed to read file for checkpoint ${cp.id}:`, e);
        }
      }
    }

    const deliverable = deliverables.find(d => d.id === cp.deliverableId);

    const verifyPrompt = `You are a governance artifact reviewer. Evaluate whether this document satisfies the deliverable requirement.

Deliverable: ${cp.checkpointName}
${deliverable?.description ? `Description: ${deliverable.description}` : ""}
Stage: ${stage?.name || "Unknown"} (Stage ${stage?.stageNumber ?? "?"})

Artifact File: ${cp.artifactFileName || "Unknown"}
${fileMetadata ? `File Type: ${fileMetadata.mimeType}` : ""}
${fileMetadata ? `Last Modified: ${fileMetadata.modifiedTime}` : ""}
${fileContent ? `\nFile Content (excerpt):\n${fileContent.substring(0, 5000)}` : "\n(File content not accessible — evaluate based on file name and metadata only)"}

Assess:
1. Does the file name and type seem appropriate for this deliverable?
2. If content is available, does it adequately cover the deliverable requirements?
3. Provide a brief summary of what the artifact contains or appears to contain.

Respond ONLY with valid JSON:
{
  "verified": true or false,
  "summary": "Brief assessment of the artifact (2-3 sentences)",
  "concerns": ["any specific concerns or gaps"] 
}`;

    try {
      const aiResponse = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [{ role: "user", content: verifyPrompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: 2048,
      });

      let result;
      try {
        result = JSON.parse(aiResponse.choices[0]?.message?.content || "{}");
      } catch {
        result = { verified: false, summary: "AI verification parsing failed", concerns: [] };
      }

      const summary = result.summary + (result.concerns?.length > 0 ? `\nConcerns: ${result.concerns.join("; ")}` : "");

      await storage.updateProjectCheckpoint(cp.id, tenantId, {
        artifactVerified: result.verified === true,
        artifactVerifiedAt: new Date(),
        artifactSummary: summary,
      });

      results.push({
        checkpointId: cp.id,
        checkpointName: cp.checkpointName,
        verified: result.verified === true,
        summary,
      });
    } catch (e: any) {
      results.push({
        checkpointId: cp.id,
        checkpointName: cp.checkpointName,
        verified: false,
        summary: `Verification failed: ${e.message}`,
      });
    }
  }

  return {
    verified: results.filter(r => r.verified).length,
    total: checkpoints.length,
    withArtifacts: checkpointsWithArtifacts.length,
    results,
  };
}
