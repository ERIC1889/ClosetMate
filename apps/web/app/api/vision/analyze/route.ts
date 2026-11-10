import { NextResponse } from 'next/server';
import { z } from 'zod';
import { openai, MODEL_DEFAULT, MODEL_FALLBACK } from '@/lib/openai/client';
import { requireUser } from '@/lib/auth/current_user';

const bodySchema = z.object({
  imageUrl: z.string().url(),
  questions: z.array(z.string().min(1)).min(1).max(8).optional(),
  highDetail: z.boolean().optional(),
});

const DEFAULT_QUESTIONS = ['material', 'pattern', 'fit'];

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { imageUrl, highDetail } = parsed.data;
  const questions = parsed.data.questions ?? DEFAULT_QUESTIONS;

  const model = highDetail ? MODEL_FALLBACK : MODEL_DEFAULT;
  const detail = highDetail ? 'high' : 'low';

  // Structured Outputs 용 동적 JSON schema — 질문 키를 그대로 사용한다.
  const properties: Record<string, { type: 'string' }> = {};
  for (const q of questions) properties[q] = { type: 'string' };
  const visionJsonSchema = {
    type: 'object',
    additionalProperties: false,
    required: questions,
    properties,
  } as const;

  // OpenAI Vision 은 외부에서 imageUrl 을 fetch 하므로 localhost / 사설망 URL 은 못 읽는다.
  // 서버에서 먼저 fetch → base64 data URL 로 인라인 인코딩해서 전달한다.
  // 공개 URL 도 같은 경로로 처리해 일관성 유지.
  let dataUrl: string;
  try {
    const r = await fetch(imageUrl);
    if (!r.ok) throw new Error(`fetch_${r.status}`);
    const ct = r.headers.get('content-type') || 'image/jpeg';
    const buf = Buffer.from(await r.arrayBuffer());
    dataUrl = `data:${ct};base64,${buf.toString('base64')}`;
  } catch (err) {
    return NextResponse.json(
      { error: 'image_fetch_failed', message: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }

  const start = Date.now();
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              `이 옷 사진을 분석하세요. 각 키에 한국어 한 줄 설명을 채우세요.\n` +
              `키: ${questions.join(', ')}.`,
          },
          { type: 'image_url', image_url: { url: dataUrl, detail } },
        ],
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'closetmate_vision_analysis',
        schema: visionJsonSchema,
        strict: true,
      },
    },
  });

  const raw = completion.choices[0]?.message?.content ?? '{}';
  let analysis: Record<string, string>;
  try {
    analysis = JSON.parse(raw) as Record<string, string>;
  } catch {
    return NextResponse.json(
      { error: 'vision_json_parse_failed', raw },
      { status: 502 }
    );
  }

  return NextResponse.json({
    analysis,
    model_used: model,
    image_detail: detail,
    fallback_triggered: highDetail,
    tokens: {
      input: completion.usage?.prompt_tokens ?? 0,
      output: completion.usage?.completion_tokens ?? 0,
    },
    latency_ms: Date.now() - start,
  });
}
