import {
  openai,
  MODEL_DEFAULT,
  MODEL_FALLBACK,
  LLM_CONFIDENCE_THRESHOLD,
} from '@/lib/openai/client';
import { logUsage } from '@/lib/openai/usage_logger';
import {
  recommendationResponseSchema,
  recommendationJsonSchema,
  type RecommendationResponse,
} from './schema';
import { SYSTEM_PROMPT, buildUserPrompt, type PromptContext } from './prompt';

function buildCandidateKeySet(ctx: PromptContext): Set<string> {
  const keys = new Set<string>();
  for (const c of ctx.candidates) {
    const sorted = [...c.clothesIds].sort();
    keys.add(sorted.join('|'));
  }
  return keys;
}

function validateAgainstCandidates(
  data: RecommendationResponse,
  candidateKeys: Set<string>,
  wardrobeMap: Map<string, unknown>
): { ok: true } | { ok: false; reason: string } {
  for (const outfit of data.outfits) {
    for (const id of outfit.clothes_ids) {
      if (!wardrobeMap.has(id)) {
        return { ok: false, reason: `hallucinated_clothes_id:${id}` };
      }
    }
    const key = [...outfit.clothes_ids].sort().join('|');
    if (!candidateKeys.has(key)) {
      return {
        ok: false,
        reason: `outfit_not_in_candidates:${outfit.clothes_ids.join(',')}`,
      };
    }
  }
  return { ok: true };
}

export type RunResult = {
  data: RecommendationResponse;
  modelUsed: string;
  fallbackTriggered: boolean;
  fallbackReason?: string;
  tokens: { input: number; output: number };
  latencyMs: number;
};

async function callOnce(
  model: string,
  ctx: PromptContext
): Promise<{
  data: RecommendationResponse | null;
  inputTokens: number;
  outputTokens: number;
  rawError?: string;
}> {
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(ctx) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'closetmate_recommendation',
        schema: recommendationJsonSchema,
        strict: true,
      },
    },
  });

  const raw = completion.choices[0]?.message?.content ?? '';
  const inputTokens = completion.usage?.prompt_tokens ?? 0;
  const outputTokens = completion.usage?.completion_tokens ?? 0;

  try {
    const parsed = recommendationResponseSchema.parse(JSON.parse(raw));
    return { data: parsed, inputTokens, outputTokens };
  } catch (err) {
    return {
      data: null,
      inputTokens,
      outputTokens,
      rawError: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function runRecommendation(ctx: PromptContext): Promise<RunResult> {
  const start = Date.now();
  const candidateKeys = buildCandidateKeySet(ctx);

  const primary = await callOnce(MODEL_DEFAULT, ctx);

  const primaryValidation = primary.data
    ? validateAgainstCandidates(primary.data, candidateKeys, ctx.wardrobeMap)
    : { ok: false as const, reason: 'no_data' };

  if (
    primary.data &&
    primaryValidation.ok &&
    primary.data.model_confidence >= LLM_CONFIDENCE_THRESHOLD
  ) {
    const result: RunResult = {
      data: primary.data,
      modelUsed: MODEL_DEFAULT,
      fallbackTriggered: false,
      tokens: { input: primary.inputTokens, output: primary.outputTokens },
      latencyMs: Date.now() - start,
    };
    logUsage('recommend', {
      modelUsed: result.modelUsed,
      inputTokens: result.tokens.input,
      outputTokens: result.tokens.output,
      latencyMs: result.latencyMs,
      fallbackTriggered: false,
    });
    return result;
  }

  const fallbackReason = !primary.data
    ? `schema_validation_failed: ${primary.rawError ?? 'unknown'}`
    : !primaryValidation.ok
      ? `candidate_validation_failed: ${primaryValidation.reason}`
      : 'nano_confidence_below_threshold';

  const secondary = await callOnce(MODEL_FALLBACK, ctx);
  if (!secondary.data) {
    throw new Error(
      `Both models failed. primary=${fallbackReason} secondary=${secondary.rawError ?? 'unknown'}`
    );
  }

  const secondaryValidation = validateAgainstCandidates(
    secondary.data,
    candidateKeys,
    ctx.wardrobeMap
  );
  if (!secondaryValidation.ok) {
    throw new Error(
      `Fallback model also failed validation: ${secondaryValidation.reason}`
    );
  }

  const result: RunResult = {
    data: secondary.data,
    modelUsed: MODEL_FALLBACK,
    fallbackTriggered: true,
    fallbackReason,
    tokens: {
      input: primary.inputTokens + secondary.inputTokens,
      output: primary.outputTokens + secondary.outputTokens,
    },
    latencyMs: Date.now() - start,
  };
  logUsage('recommend', {
    modelUsed: result.modelUsed,
    inputTokens: result.tokens.input,
    outputTokens: result.tokens.output,
    latencyMs: result.latencyMs,
    fallbackTriggered: true,
    fallbackReason,
  });
  return result;
}
