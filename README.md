<div align="center">

# 👗 ClosetMate

**사진 한 장으로 옷장을 등록하고, 날씨·일정·기분에 맞는 코디를 AI가 골라주는 모바일 옷장 매니저**

<p>
  <img alt="Expo SDK 56" src="https://img.shields.io/badge/Expo-SDK%2056-000020?logo=expo&logoColor=white">
  <img alt="React Native" src="https://img.shields.io/badge/React%20Native-0.83-61DAFB?logo=react&logoColor=black">
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white">
  <img alt="PyTorch" src="https://img.shields.io/badge/PyTorch-2.4%2B-EE4C2C?logo=pytorch&logoColor=white">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white">
  <img alt="OpenAI" src="https://img.shields.io/badge/OpenAI-GPT%20%2B%20Whisper-412991?logo=openai&logoColor=white">
  <img alt="pnpm" src="https://img.shields.io/badge/pnpm-workspace-F69220?logo=pnpm&logoColor=white">
</p>

<sub>멀티모달 입력 (이미지 · 음성 · 위치) × 전이학습 분류기 (MobileNetV3 / ResNet50) × LLM 랭킹 (nano-first + mini fallback)</sub>

</div>

---

## ✨ 무엇을 하나요?

| | 기능 | 동작 방식 |
|:-:|---|---|
| 📸 | **사진으로 옷 등록** | 촬영/선택 → 업로드 → **MobileNetV3 multi-task 분류기**가 카테고리 · 색상 · 스타일 자동 태깅. 확신도가 낮으면 "확인 필요" 배지로 사용자 수정 유도 |
| 🎙 | **음성 · 텍스트로 코디 요청** | "내일 비 오는데 출근룩 추천해줘" → Whisper STT → 서버가 옷장에서 **후보 조합 생성** → LLM이 랭킹 + 이유 설명 |
| 🧠 | **nano-first + mini fallback** | 가벼운 모델로 먼저 답하고, `model_confidence < 0.7` 이거나 스키마/후보 검증에 실패하면 자동으로 상위 모델 재호출 |
| 🌦 | **날씨 반영 추천** | 위치 권한 → OpenWeather → 추천 컨텍스트에 기온/강수 포함 |
| 👕 | **"이거 입었어요"** | 착장 기록 → `wearCount` 증가 → 통계에 반영 |
| 📊 | **옷장 인사이트** | 카테고리 분포 도넛 차트, 가장 많이 입은 옷, 60일 넘게 안 입은 옷, 활용률 |

---

## 🏗 아키텍처

```mermaid
flowchart LR
  subgraph mobile["📱 Mobile · Expo SDK 56"]
    M1["홈 · 옷장 · 추천 · 통계 · 설정"]
    M2["카메라 · 마이크 · 위치"]
  end

  subgraph web["🖥 Backend · Next.js 16"]
    A1["/api/wardrobe<br/>/api/outfits · /api/analytics"]
    A2["/api/ml/classify<br/>onnxruntime-node + sharp"]
    A3["/api/recommend<br/>후보 생성 → nano → mini"]
    A4["/api/vision · /api/voice<br/>GPT Vision · Whisper"]
    DB[("Postgres<br/>Drizzle ORM")]
  end

  subgraph ml["🧠 ML · PyTorch"]
    T["train.py<br/>MobileNetV3-Small / ResNet50"]
    C["convert_tflite.py<br/>litert-torch"]
    O["fashion_classifier<br/>.onnx · .tflite"]
  end

  M1 --> A1 --> DB
  M1 --> A3 --> DB
  M2 --> A2
  M2 --> A4
  T --> C --> O
  O -. 서버 번들 .-> A2
  O -. EAS dev build .-> M2
```

**데이터 흐름 (옷 등록)** — 사진 → `/api/blob/upload` → `/api/ml/classify` (ONNX) → 라벨 + 확신도 → `/api/wardrobe` 저장
**데이터 흐름 (추천)** — prompt (+ 음성 → `/api/voice`) → `/api/recommend` → 룰 기반 후보 생성 → LLM 랭킹 → 후보 외 `clothes_id` 검증 → 응답

---

## 🧰 기술 스택

| 영역 | 선택 | 메모 |
|---|---|---|
| **Mobile** | React Native · Expo SDK 56 · expo-router · zustand · react-query | 5탭 + modal, Expo Go 호환 |
| **Backend** | Next.js 16 App Router · TypeScript · zod | API routes 전용 |
| **DB** | PostgreSQL 16 · Drizzle ORM | `outfit_items` 조인 테이블로 정규화 |
| **분류기** | PyTorch · torchvision · MobileNetV3-Small / ResNet50 | backbone freeze + multi-task heads |
| **서버 추론** | onnxruntime-node · sharp | Expo Go 에서도 실제 모델 결과 사용 |
| **온디바이스 추론** | react-native-fast-tflite · litert-torch | EAS dev build 시 자동 전환 |
| **LLM / STT / Vision** | OpenAI (Structured Outputs · Whisper 계열 · GPT Vision) | 모델 ID 는 환경변수로 분리 |
| **날씨** | OpenWeather | 선택 사항 |
| **Monorepo** | pnpm workspace | `apps/web`, `apps/mobile`, `ml` |

---

## 📁 저장소 구조

```
ClosetMate/
├── apps/
│   ├── mobile/                  # React Native + Expo SDK 56
│   │   ├── app/(tabs)/          #   홈 · 옷장 · 추천 · 통계 · 설정
│   │   ├── app/add-clothes.tsx  #   옷 등록 modal
│   │   ├── app/clothes/[id].tsx #   옷 상세
│   │   ├── components/          #   UI 프리미티브 · 차트
│   │   ├── lib/ml.ts            #   tflite → server-onnx → mock 분기
│   │   ├── lib/voice.ts         #   expo-audio 녹음 래퍼
│   │   ├── lib/userId.ts        #   SecureStore UUID 자동 발급
│   │   └── assets/models/       #   fashion_classifier.tflite
│   └── web/                     # Next.js 16 백엔드
│       ├── app/api/             #   wardrobe · recommend · voice · vision · ml/classify · …
│       ├── lib/ml/              #   ONNX 세션 + 전처리
│       ├── lib/recommend/       #   후보 생성 · 프롬프트 · nano/mini runner · zod 스키마
│       ├── lib/auth/            #   헤더 기반 임시 인증 (Clerk 교체 지점)
│       ├── lib/db/              #   Drizzle 스키마 / 클라이언트
│       ├── drizzle/             #   마이그레이션 SQL
│       └── ml-models/           #   fashion_classifier.onnx (+ .data)
├── ml/                          # Python — 전이학습 · 변환 · 벤치마크
│   ├── src/
│   │   ├── labels.py            #   category 7 · color 11 · style 5
│   │   ├── dataset.py           #   Kaggle styles.csv → 라벨 매핑
│   │   ├── model.py             #   backbone + 3 heads
│   │   ├── train.py             #   학습 루프 (MPS / CUDA / CPU)
│   │   ├── convert_tflite.py    #   PyTorch → ONNX · TFLite
│   │   └── benchmark.py         #   CPU 추론 속도 비교
│   ├── outputs/                 #   *_metrics.json · benchmark.json (모델 파일은 미추적)
│   └── requirements.txt
├── package.json · pnpm-workspace.yaml
└── README.md
```

---

## 🚀 빠른 시작

### 사전 요구사항

- Node.js 20+ · pnpm 9+
- Docker (로컬 Postgres)
- macOS + Xcode iOS Simulator, 또는 실기기 + Expo Go
- OpenAI API 키
- *(선택)* Python 3.11+ · Kaggle 계정 — 모델 재학습 시

### 1. 의존성 설치

```bash
pnpm install
```

### 2. 환경변수

```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env
```

| 파일 | 꼭 채울 값 |
|---|---|
| `apps/web/.env.local` | `DATABASE_URL`, `OPENAI_API_KEY` (모델 ID 는 비우면 기본값 사용) |
| `apps/mobile/.env` | `EXPO_PUBLIC_API_URL` — 시뮬레이터는 `http://localhost:3000`, 실기기는 Mac LAN IP |

### 3. 로컬 Postgres + 마이그레이션

```bash
docker run -d --name closetmate-pg \
  -e POSTGRES_USER=closetmate -e POSTGRES_PASSWORD=closetmate -e POSTGRES_DB=closetmate \
  -p 5432:5432 postgres:16-alpine

DATABASE_URL=postgresql://closetmate:closetmate@localhost:5432/closetmate \
  pnpm --filter web db:migrate
```

### 4. 실행

```bash
pnpm --filter web dev                              # http://localhost:3000
pnpm --filter mobile exec expo start --ios --go    # iOS Simulator + Expo Go
```

다음부터는 `docker start closetmate-pg` 한 줄로 DB 복귀.

---

## 🧪 ML 파이프라인

### 학습 셋업

| 항목 | 값 |
|---|---|
| 데이터셋 | [Fashion Product Images (Small)](https://www.kaggle.com/datasets/paramaggarwal/fashion-product-images-small) — 44,441장 → 라벨 매핑 후 35,099장 |
| 라벨 | category 7 · color 11 · style 5 (multi-task) |
| Backbone | ImageNet pretrained, **freeze** — head 만 학습 |
| 증강 | Resize 256 → RandomCrop 224 → HFlip → ColorJitter |
| 최적화 | Adam · lr 1e-3 · 10 epochs · 3 head CrossEntropy 합산 |
| 하드웨어 | Apple Silicon (PyTorch MPS) |

### MobileNetV3-Small vs ResNet50

| | MobileNetV3-Small | ResNet50 | 비고 |
|---|---:|---:|---|
| val acc · category | **97.5 %** | 97.5 % | 동률 |
| val acc · color | 66.9 % | 67.0 % | 라벨 노이즈 (아래 참고) |
| val acc · style | 86.5 % | 86.6 % | 동률 |
| 전체 파라미터 | 1.54 M | 23.56 M | **15×** |
| 학습 파라미터 (heads) | 23.6 K | 47.1 K | |
| `.tflite` 크기 | **6.0 MB** | 89.9 MB | **15×** |
| 추정 MACs | **56 M** | 4,096 M | **73×** |
| 학습 시간 (10 ep) | **23 분** | 53 분 | 2.3× |
| CPU 추론 (PyTorch, batch 1) | 30.8 ms | 20.4 ms | ※ |

> ※ PyTorch CPU 에서는 depthwise conv 커널 최적화가 부족해 ResNet50 이 더 빠르게 측정됩니다. 모바일 NPU / TFLite 환경에서는 MACs 차이(73×)가 지배적이므로, 정확도가 같은 **MobileNetV3-Small 을 배포 모델로 선택**했습니다.

### 재현

```bash
pip install -r ml/requirements.txt

# 데이터 (Kaggle 토큰 필요)
kaggle datasets download -d paramaggarwal/fashion-product-images-small -p ml/data/raw --unzip

# 학습
python -m ml.src.train --backbone mobilenet_v3_small --epochs 10 --batch-size 64
python -m ml.src.train --backbone resnet50            --epochs 10 --batch-size 32

# PyTorch → ONNX + TFLite (litert-torch 직변환)
python -m ml.src.convert_tflite \
  --backbone mobilenet_v3_small \
  --weights ml/outputs/mobilenet_v3_small_fashion.pth \
  --output  ml/outputs/fashion_classifier.tflite

# 앱 번들로 복사
cp ml/outputs/fashion_classifier.onnx{,.data} apps/web/ml-models/
cp ml/outputs/fashion_classifier.tflite        apps/mobile/assets/models/

# CPU 추론 벤치마크
python -m ml.src.benchmark --runs 30
```

학습 로그는 `ml/outputs/*_metrics.json`, 벤치마크는 `ml/outputs/benchmark.json` 에 남습니다.

---

## 🔌 API

모든 라우트는 `x-user-id` 헤더가 필요합니다 (`requireUser()`).

| Method | Route | 설명 |
|---|---|---|
| `POST` | `/api/users/me` | 앱 부트 시 유저 upsert |
| `GET` `POST` | `/api/wardrobe` | 옷장 조회 / 등록 |
| `GET` `PATCH` `DELETE` | `/api/wardrobe/:id` | 옷 상세 / 수정 / 삭제 |
| `POST` | `/api/blob/upload` | 이미지 업로드 (로컬 파일 어댑터) |
| `POST` | `/api/ml/classify` | **MobileNetV3 ONNX 서버 추론** |
| `POST` | `/api/vision/analyze` | GPT Vision Structured Outputs |
| `POST` | `/api/voice` | 음성 → 텍스트 |
| `POST` | `/api/recommend` | 후보 생성 + nano → mini fallback 랭킹 |
| `POST` | `/api/outfits` | 착장 기록 + `wearCount` 증가 |
| `GET` | `/api/analytics` | 통계 |

---

## 📱 화면 구성

| 탭 | 내용 |
|---|---|
| **홈** | 시간대별 인사 · 옷장 stat · 빠른 등록 · 분류 확인 필요 알림 · 최근 추천 |
| **옷장** | 카테고리 chip 필터 · 카드 그리드 · wear count 배지 · FAB |
| **추천** | 텍스트 / 음성 prompt · 빠른 prompt chips (☕ 카페 · 💼 출근 · 🌧️ 비 …) · 결과 카드 + "이거 입었어요" |
| **통계** | 도넛 차트 · Top worn · 60일 미착용 갤러리 · 활용률 |
| **설정** | 사용자 · 모델 · 환경 정보 |

---

## 🧭 주요 설계 결정

- **LLM hallucination 0 %** — 서버가 룰 기반으로 후보 조합을 먼저 만들고, LLM 은 그 안에서만 고릅니다. 후보에 없는 `clothes_id` 가 나오면 검증에서 거부하고 fallback 합니다.
- **nano-first + mini fallback** — 비용을 아끼면서 품질이 필요할 때만 상위 모델을 씁니다. 모델 ID 는 환경변수로 분리해 카탈로그 변경에 대응합니다.
- **서버 ONNX 추론 우선** — Expo Go 에서는 native module 을 못 쓰므로 같은 가중치를 ONNX 로 서버에서 돌립니다. EAS dev build 에서는 `EXPO_PUBLIC_USE_REAL_TFLITE=true` 로 온디바이스 TFLite 로 전환됩니다.
- **교체 지점 단일화** — 인증은 `lib/auth/current_user.ts` 한 곳, 이미지 저장은 `/api/blob/upload` 한 곳만 바꾸면 Clerk / Vercel Blob 으로 이전할 수 있습니다.
- **낮은 확신도는 숨기지 않기** — `aiConfidence` 가 낮은 옷은 "확인 필요" 배지로 노출하고, 사용자가 수정하면 `userCorrected` 로 기록합니다.

---

## ⚠️ 알려진 한계

- **color 정확도 67 %** — 원본 데이터의 46개 색상을 11개로 매핑하면서 라벨 노이즈가 생깁니다 (Maroon → red, Cream → beige 등).
- **이미지 업로드는 로컬 파일** (`public/uploads/`) — Vercel 배포 시 `@vercel/blob` 으로 교체 필요.
- **인증은 MVP 수준** — SecureStore UUID + 헤더. Clerk 도입 전까지는 기기 단위 계정입니다.
- **온디바이스 추론은 dev build 전용** — Expo Go 에서는 서버 추론으로 우회합니다.
- **onnx-tf 변환 경로 폐기** — 최신 TF 와 호환되지 않아 Google 공식 `litert-torch` 로 직변환합니다.

---

## 📄 라이선스

학습용 프로젝트입니다. 상업적 사용을 금지합니다.
