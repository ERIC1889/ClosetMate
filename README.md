# ClosetMate

옷 사진을 찍으면 종류·색상·스타일을 분류해 옷장에 넣고, 말이나 글로 상황을 입력하면 가진 옷으로만 코디를 추천하는 모바일 앱입니다. 2026.03–2026.06 개인 프로젝트로 기획, 분류 모델 학습, 모바일 앱과 API를 혼자 만들었습니다. 출시하지 않았습니다.

## 무엇을 하나요

- **사진으로 옷 등록** — 촬영하거나 고른 사진을 올리면 MobileNetV3 분류기가 카테고리·색상·스타일을 붙입니다. 확신도가 낮으면 "확인 필요" 표시를 달아 사용자가 고치게 합니다.
- **음성·텍스트로 코디 요청** — "내일 비 오는데 출근룩 추천해줘"처럼 말하면 Whisper로 받아 적고, 서버가 옷장에서 후보 조합을 만든 뒤 LLM이 그중에서 고르고 이유를 설명합니다.
- **날씨 반영** — 위치 권한을 주면 OpenWeather의 기온·강수를 추천에 넣습니다.
- **착용 기록과 통계** — "이거 입었어요"로 기록하면 카테고리 분포, 많이 입은 옷, 60일 넘게 안 입은 옷, 활용률을 보여 줍니다.
- **선택형 상세 분석** — 비용이 드는 OpenAI Vision 분석은 사용자가 직접 누를 때만 호출합니다.

## 구조

모바일 앱 → Next.js API → OpenAI · OpenWeather · PostgreSQL. 분류 모델은 오프라인에서 학습해 서버 안에서 ONNX로 추론합니다.

- 옷 등록: 사진 → `/api/blob/upload` → `/api/ml/classify`(ONNX) → 라벨·확신도 → `/api/wardrobe` 저장
- 추천: 요청(+음성은 `/api/voice`) → `/api/recommend` → 규칙으로 후보 생성 → LLM 선택 → 후보 밖 `clothes_id` 검증 → 응답

| 경로 | 내용 |
|---|---|
| `apps/mobile/` | Expo SDK 56 · React Native. 홈 · 옷장 · 추천 · 통계 · 설정 탭, 옷 등록·상세 화면, `lib/ml.ts`(tflite → 서버 ONNX → mock 분기), `lib/voice.ts` 녹음, `lib/userId.ts` 기기 식별자 |
| `apps/web/` | Next.js 16 API. `app/api/`(wardrobe · recommend · voice · vision · ml/classify 등), `lib/ml/` ONNX 세션과 전처리, `lib/recommend/` 후보 생성·프롬프트·nano/mini 실행·zod 스키마, `lib/auth/` 헤더 기반 임시 인증, `lib/db/` Drizzle 스키마, `drizzle/` 마이그레이션, `ml-models/` ONNX 모델 |
| `ml/` | PyTorch 전이학습·변환·벤치마크. `labels.py`(category 7 · color 11 · style 5), `dataset.py`, `model.py`(백본 + 헤드 3개), `train.py`, `convert_tflite.py`, `benchmark.py`, `outputs/` 학습 지표와 벤치마크 |

## 실행

준비물: Node.js 20+ · pnpm 9+ · Docker · OpenAI API 키 · iOS 시뮬레이터 또는 Expo Go. 모델을 다시 학습하려면 Python 3.11+와 Kaggle 계정이 필요합니다.

```bash
pnpm install

cp apps/web/.env.example apps/web/.env.local     # DATABASE_URL, OPENAI_API_KEY
cp apps/mobile/.env.example apps/mobile/.env     # EXPO_PUBLIC_API_URL (시뮬레이터는 http://localhost:3000, 실기기는 Mac의 LAN IP)

docker run -d --name closetmate-pg \
  -e POSTGRES_USER=closetmate -e POSTGRES_PASSWORD=closetmate -e POSTGRES_DB=closetmate \
  -p 5432:5432 postgres:16-alpine
DATABASE_URL=postgresql://closetmate:closetmate@localhost:5432/closetmate pnpm --filter web db:migrate

pnpm --filter web dev                              # http://localhost:3000
pnpm --filter mobile exec expo start --ios --go    # iOS 시뮬레이터 + Expo Go
```

### API

모든 라우트는 `x-user-id` 헤더가 필요합니다.

| Method | Route | 설명 |
|---|---|---|
| `POST` | `/api/users/me` | 앱 시작 시 사용자 upsert |
| `GET` `POST` | `/api/wardrobe` | 옷장 조회 · 등록 |
| `GET` `PATCH` `DELETE` | `/api/wardrobe/:id` | 옷 상세 · 수정 · 삭제 |
| `POST` | `/api/blob/upload` | 이미지 업로드 |
| `POST` | `/api/ml/classify` | MobileNetV3 ONNX 서버 추론 |
| `POST` | `/api/vision/analyze` | OpenAI Vision 상세 분석 |
| `POST` | `/api/voice` | 음성 → 텍스트 |
| `POST` | `/api/recommend` | 후보 생성 → LLM 선택 → 검증 |
| `POST` | `/api/outfits` | 착용 기록 |
| `GET` | `/api/analytics` | 통계 |

### 모델 재학습

```bash
pip install -r ml/requirements.txt
kaggle datasets download -d paramaggarwal/fashion-product-images-small -p ml/data/raw --unzip

python -m ml.src.train --backbone mobilenet_v3_small --epochs 10 --batch-size 64
python -m ml.src.train --backbone resnet50            --epochs 10 --batch-size 32
python -m ml.src.convert_tflite --backbone mobilenet_v3_small \
  --weights ml/outputs/mobilenet_v3_small_fashion.pth --output ml/outputs/fashion_classifier.tflite
cp ml/outputs/fashion_classifier.onnx{,.data} apps/web/ml-models/
python -m ml.src.benchmark --runs 30
```

학습 기록은 `ml/outputs/*_metrics.json`, 벤치마크는 `ml/outputs/benchmark.json`에 있습니다.

## 기술

Expo · React Native · Next.js 16 · TypeScript · zod · PostgreSQL 16 · Drizzle ORM · PyTorch · torchvision · onnxruntime-node · sharp · OpenAI API(Structured Outputs · Whisper · Vision) · OpenWeather · pnpm workspace

## 문제 해결

- **옷장에 없는 옷을 추천하는 LLM** — LLM에 코디를 맡기면 없는 옷의 ID를 만들거나 만들 수 없는 조합을 고르는 일이 있었습니다. 프롬프트 지시, 응답 형식 강제, 규칙 기반 후보 중에서 고르게 하기를 비교한 끝에, 서버가 색상·스타일·날씨·최근 착용으로 후보 조합을 먼저 만들고 LLM은 그중에서만 고르게 했습니다. 답은 형식(JSON Schema → zod) → 옷 ID가 옷장에 있는지 → 조합이 후보에 있는지 순서로 검증하고, 실패하거나 모델의 확신도가 낮으면 보조 모델로 한 번 더 받습니다.
- **분류 모델 선택과 적용** — 폰에서도 돌릴 만큼 가벼운 분류 모델이 필요했습니다. MobileNetV3-Small과 ResNet50을 같은 조건(백본 고정, Fashion Product Images 약 35,000장, 10 epoch)으로 비교해 정확도가 거의 같고 크기가 약 15분의 1인 MobileNetV3-Small을 골랐고, 백본 위에 카테고리·색상·스타일 헤드 3개를 얹어 모델 하나로 세 가지를 분류합니다. Expo Go에서는 기기 안에서 모델을 불러올 수 없어 지금은 서버에서 ONNX로 추론합니다.

### 모델 비교

| | MobileNetV3-Small | ResNet50 |
|---|---:|---:|
| 검증 정확도 · category | 97.5% | 97.5% |
| 검증 정확도 · color | 66.9% | 67.0% |
| 검증 정확도 · style | 86.5% | 86.6% |
| 전체 파라미터 | 1.54M | 23.56M |
| 가중치 크기 | 6.0MB | 90.2MB |
| 학습 시간 (10 epoch) | 23분 | 53분 |
| CPU 추론 (PyTorch, batch 1) | 30.8ms | 20.4ms |

CPU에서는 ResNet50이 더 빨랐지만, 크기와 연산량 차이가 커서 온디바이스 추론으로의 확장까지 보고 MobileNetV3-Small을 택했습니다.

## 결과

- 가진 옷으로만 추천합니다. 형식이 틀렸거나 옷장에 없는 옷을 담은 추천은 사용자에게 가기 전에 막히고, 실측 23회에서 기본 모델이 19회 통과하고 보조 모델이 4회 처리했으며 최종 실패는 0건이었습니다.
- 사진 등록 → 분류 → 후보 생성 → LLM 추천 → 서버 검증까지 전체 흐름을 구현했습니다.
- 약 15분의 1 크기(6.0MB 대 90.2MB)의 MobileNetV3-Small을 채택해 서버에서 ONNX로 추론합니다.

## 한계

- color 정확도가 67%입니다. 원본의 46개 색상을 11개로 묶으면서 라벨에 노이즈가 생겼습니다.
- 이미지는 로컬 파일(`public/uploads/`)에 저장합니다. 배포하려면 Vercel Blob 같은 저장소로 바꿔야 합니다.
- 인증은 기기 식별자와 헤더로만 구분하는 MVP 수준입니다.
- 온디바이스 추론(TFLite)은 개발 빌드에서만 켜지고 Expo Go에서는 서버 추론으로 우회합니다.
- 추천 품질(수락률)은 재지 않았고, 확신도는 모델이 스스로 매긴 값입니다.

## 기록

- 포트폴리오: https://junyoung-portfolio.vercel.app/projects/closetmate

학습용 프로젝트입니다. 상업적 사용을 금지합니다.
