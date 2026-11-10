export type LLMUsage = {
  modelUsed: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  fallbackTriggered: boolean;
  fallbackReason?: string;
};

export function logUsage(label: string, usage: LLMUsage) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `[llm:${label}] model=${usage.modelUsed} in=${usage.inputTokens} out=${usage.outputTokens} ms=${usage.latencyMs} fallback=${usage.fallbackTriggered}${
        usage.fallbackReason ? ` reason=${usage.fallbackReason}` : ''
      }`
    );
  }
}
