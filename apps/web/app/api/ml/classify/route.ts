import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/current_user';
import { classifyImageUrl } from '@/lib/ml/inference';

// 서버 사이드 MobileNetV3-Small ONNX 추론.
// 모바일이 직접 TFLite 를 못 돌릴 때 (Expo Go) 사용한다.
// EAS dev build 가 나오면 모바일이 lib/ml.ts 의 react-native-fast-tflite 경로로
// 갈아타고 이 라우트는 폴백/디버깅용으로만 남는다.

const bodySchema = z.object({
  imageUrl: z.string().url(),
});

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await classifyImageUrl(parsed.data.imageUrl);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: 'inference_failed', message: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
