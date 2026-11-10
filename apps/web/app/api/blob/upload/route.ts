import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { requireUser } from '@/lib/auth/current_user';

// 로컬 개발용 어댑터. 사진을 apps/web/public/uploads/<userId>/ 에 저장하고
// 같은 호스트에서 정적으로 서빙되는 절대 URL 을 돌려준다.
//
// 배포 (Vercel) 로 옮길 때는 fs.writeFile 부분을 @vercel/blob 의 put() 으로 갈아끼우면 된다.
// 클라이언트가 받는 응답 shape ({ url, pathname, size, content_type }) 는 동일하게 유지한다.

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);

function extFromContentType(ct: string, fallback = 'jpg'): string {
  if (ct === 'image/jpeg') return 'jpg';
  if (ct === 'image/png') return 'png';
  if (ct === 'image/webp') return 'webp';
  if (ct === 'image/heic') return 'heic';
  return fallback;
}

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file field required' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'file_too_large' }, { status: 413 });
  }
  if (file.type && !ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: `unsupported_content_type:${file.type}` },
      { status: 415 }
    );
  }

  const contentType = file.type || 'image/jpeg';
  const ext = file.name?.split('.').pop()?.toLowerCase() || extFromContentType(contentType);
  const filename = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const relDir = join('uploads', auth.userId);
  const absDir = join(process.cwd(), 'public', relDir);
  await mkdir(absDir, { recursive: true });

  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(join(absDir, filename), buf);

  // request URL 의 호스트를 그대로 반사한다 — Simulator 는 localhost, 실기기는 Mac IP.
  const origin = new URL(req.url).origin;
  const pathname = `/${relDir}/${filename}`.replace(/\\/g, '/');
  return NextResponse.json({
    url: `${origin}${pathname}`,
    pathname,
    size: file.size,
    content_type: contentType,
  });
}
