import { NextResponse } from 'next/server';
import { openai, MODEL_TRANSCRIBE } from '@/lib/openai/client';
import { requireUser } from '@/lib/auth/current_user';

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const formData = await req.formData();
  const audio = formData.get('audio');

  if (!(audio instanceof File)) {
    return NextResponse.json({ error: 'audio file required' }, { status: 400 });
  }

  const start = Date.now();
  const result = await openai.audio.transcriptions.create({
    file: audio,
    model: MODEL_TRANSCRIBE,
    language: 'ko',
  });

  return NextResponse.json({
    transcript: result.text,
    language: 'ko',
    model_used: MODEL_TRANSCRIBE,
    latency_ms: Date.now() - start,
  });
}
