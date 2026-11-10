# 🧠 ML — 전이학습 분류기

Kaggle Fashion Product Images 로 **MobileNetV3-Small / ResNet50** backbone 을 freeze 한 채
category · color · style 3개 head 만 학습하는 multi-task 분류기입니다.
학습 → ONNX/TFLite 변환 → CPU 벤치마크까지 한 디렉토리에서 재현할 수 있습니다.

## 구성

```
ml/
├── src/
│   ├── labels.py           # category 7 · color 11 · style 5 (모바일 lib/labels.ts 와 순서 동일)
│   ├── dataset.py          # styles.csv → 라벨 매핑, 이미지 로딩
│   ├── model.py            # backbone + 3 Linear heads
│   ├── train.py            # 학습 루프 (MPS / CUDA / CPU 자동 선택)
│   ├── convert_tflite.py   # PyTorch → ONNX + TFLite (litert-torch)
│   └── benchmark.py        # CPU 추론 속도 비교
├── outputs/
│   ├── mobilenet_v3_small_metrics.json
│   ├── resnet50_metrics.json
│   └── benchmark.json      # (*.pth / *.onnx / *.tflite 는 git 미추적)
└── requirements.txt
```

## 환경 셋업

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r ml/requirements.txt
```

## 데이터 준비

[Fashion Product Images (Small)](https://www.kaggle.com/datasets/paramaggarwal/fashion-product-images-small)
— Kaggle 토큰이 있으면 CLI 로 바로 받을 수 있습니다.

```bash
kaggle datasets download -d paramaggarwal/fashion-product-images-small \
  -p ml/data/raw --unzip
```

압축 해제 후 구조:

```
ml/data/raw/
├── images/
│   ├── 15970.jpg
│   └── ...
└── styles.csv
```

## 학습

저장소 루트에서 실행합니다.

```bash
# 배포 모델
python -m ml.src.train --backbone mobilenet_v3_small --epochs 10 --batch-size 64

# 비교 baseline
python -m ml.src.train --backbone resnet50 --epochs 10 --batch-size 32
```

산출물: `ml/outputs/<backbone>_fashion.pth`, `ml/outputs/<backbone>_metrics.json`

## 변환 (PyTorch → ONNX · TFLite)

```bash
python -m ml.src.convert_tflite \
  --backbone mobilenet_v3_small \
  --weights ml/outputs/mobilenet_v3_small_fashion.pth \
  --output  ml/outputs/fashion_classifier.tflite
```

같은 경로에 검증용 `fashion_classifier.onnx` (+ `.data`) 도 함께 생성됩니다.

| 산출물 | 복사 위치 | 용도 |
|---|---|---|
| `fashion_classifier.onnx` + `.data` | `apps/web/ml-models/` | 서버 추론 (`/api/ml/classify`) |
| `fashion_classifier.tflite` | `apps/mobile/assets/models/` | 온디바이스 추론 (EAS dev build) |

> onnx-tf 경로는 최신 TensorFlow 와 호환되지 않아 폐기하고, Google 공식 `litert-torch` 로 직변환합니다.

## 벤치마크

```bash
python -m ml.src.benchmark --runs 30
```

## 결과

| | MobileNetV3-Small | ResNet50 |
|---|---:|---:|
| val acc · category | **97.49 %** | 97.46 % |
| val acc · color | 66.93 % | 67.02 % |
| val acc · style | 86.52 % | 86.58 % |
| 전체 파라미터 | 1.54 M | 23.56 M |
| 학습 파라미터 (heads) | 23,575 | 47,127 |
| `.pth` 크기 | 6.0 MB | 90.2 MB |
| `.tflite` 크기 | **6.0 MB** | 89.9 MB |
| 추정 MACs | **56 M** | 4,096 M |
| 총 학습 시간 (10 ep, MPS) | **23.1 분** | 52.9 분 |
| CPU 추론 mean / p90 (ms) | 30.8 / 31.3 | 20.4 / 21.6 |

정확도는 사실상 동률이고, 모델 크기 15배 · MACs 73배 차이로 **MobileNetV3-Small** 을 배포 모델로 채택했습니다.
PyTorch CPU 에서 ResNet50 이 더 빠르게 측정된 것은 depthwise conv 커널 최적화 부족 때문으로,
모바일 NPU / TFLite 환경에서는 MACs 차이가 지배적입니다.

color 정확도가 낮은 이유는 원본 46색을 11색으로 매핑하면서 생긴 라벨 노이즈 (Maroon → red, Cream → beige 등) 입니다.
