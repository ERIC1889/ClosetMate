# 🖥 ClosetMate Backend — Next.js 16

모바일 앱이 호출하는 API 서버입니다. UI 는 없고 `app/api/*` 라우트만 제공합니다.

## 구성

```
apps/web/
├── app/api/
│   ├── users/me          # 부트 시 유저 upsert
│   ├── wardrobe          # 옷장 CRUD
│   ├── blob/upload       # 이미지 업로드 (로컬 파일 어댑터)
│   ├── ml/classify       # MobileNetV3 ONNX 서버 추론
│   ├── vision/analyze    # GPT Vision Structured Outputs
│   ├── voice             # 음성 → 텍스트
│   ├── recommend         # 후보 생성 + nano → mini fallback 랭킹
│   ├── outfits           # 착장 기록
│   └── analytics         # 통계
├── lib/
│   ├── auth/             # x-user-id 헤더 기반 임시 인증 (Clerk 교체 지점)
│   ├── db/               # Drizzle 스키마 · 클라이언트
│   ├── ml/               # onnxruntime-node 세션 + sharp 전처리
│   ├── openai/           # 클라이언트 · usage 로거
│   ├── recommend/        # 후보 생성 · 프롬프트 · runner · zod 스키마
│   └── weather/          # OpenWeather
├── drizzle/              # 마이그레이션 SQL
└── ml-models/            # fashion_classifier.onnx (+ .data)
```

## 실행

```bash
cp .env.example .env.local        # DATABASE_URL, OPENAI_API_KEY 채우기
pnpm db:migrate                   # Drizzle 마이그레이션
pnpm dev                          # http://localhost:3000
```

| 스크립트 | 설명 |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js |
| `pnpm db:generate` | 스키마 변경 → 마이그레이션 SQL 생성 |
| `pnpm db:migrate` | 마이그레이션 적용 |
| `pnpm db:studio` | Drizzle Studio |
| `pnpm typecheck` / `pnpm lint` | 타입 · 린트 |

## 환경변수

`.env.example` 참고. 필수는 `DATABASE_URL` 과 `OPENAI_API_KEY` 이며, 모델 ID (`OPENAI_MODEL_DEFAULT` / `OPENAI_MODEL_FALLBACK` / `OPENAI_MODEL_TRANSCRIBE`) 는 비우면 코드 기본값으로 동작합니다.

## 배포 시 교체 지점

| 항목 | 현재 (로컬) | 배포 |
|---|---|---|
| 이미지 저장 | `public/uploads/<userId>/` | `@vercel/blob` (`app/api/blob/upload`) |
| 인증 | `x-user-id` 헤더 + `DEV_FAKE_USER_ID` | Clerk (`lib/auth/current_user.ts`) |
| DB | Docker Postgres | Neon 등 — `DATABASE_URL` 만 변경 |

자세한 내용은 [루트 README](../../README.md) 를 참고하세요.
