import { CATEGORIES, COLORS, STYLES } from './labels';

// 분류기 추론 진입점. 우선순위:
//   1) EXPO_PUBLIC_USE_REAL_TFLITE === 'true' + 모델 번들 + dev build → 온디바이스 TFLite
//   2) (기본) 서버 사이드 ONNX inference — /api/ml/classify 에 imageUrl 전달
//   3) mock 폴백 — 서버 미연결 / 추론 실패 시
//
// 모바일이 Expo Go 일 때는 react-native-fast-tflite native module 을 못 쓰므로 2번 경로가 동작한다.
// EAS dev build 가 나오면 1번 경로로 자동 전환.

const USE_REAL = process.env.EXPO_PUBLIC_USE_REAL_TFLITE === 'true';

export type ClassificationResult = {
  category: string;
  color: string;
  style: string;
  confidence: {
    category: number;
    color: number;
    style: number;
    min: number;
  };
  modelVersion: string;
  source: 'mock' | 'tflite' | 'server-onnx';
};

type TfliteModel = {
  runSync: (inputs: unknown[]) => Float32Array[];
};

let modelPromise: Promise<TfliteModel | null> | null = null;
async function loadModel(): Promise<TfliteModel | null> {
  if (!USE_REAL) return null;
  if (modelPromise) return modelPromise;
  modelPromise = (async () => {
    try {
      const { loadTensorflowModel } = await import('react-native-fast-tflite');
      const model = await loadTensorflowModel(
        require('../assets/models/fashion_classifier.tflite'),
      );
      return model as unknown as TfliteModel;
    } catch (err) {
      console.warn('[ml] tflite load failed, falling back:', err);
      return null;
    }
  })();
  return modelPromise;
}

function mockClassify(): ClassificationResult {
  return {
    category: 'top',
    color: 'white',
    style: 'casual',
    confidence: { category: 0.6, color: 0.55, style: 0.5, min: 0.5 },
    modelVersion: 'mock-v0',
    source: 'mock',
  };
}

async function classifyOnServer(imageUrl: string): Promise<ClassificationResult | null> {
  try {
    const { api } = await import('./api');
    const r = await api.classifyImage({ imageUrl });
    return {
      category: r.category,
      color: r.color,
      style: r.style,
      confidence: r.confidence,
      modelVersion: r.modelVersion,
      source: 'server-onnx',
    };
  } catch (err) {
    console.warn('[ml] server classify failed:', err);
    return null;
  }
}

/**
 * 이미지를 분류한다.
 * - 로컬 file:// URI 만 있는 경우 (사진 막 찍은 직후) → mock
 * - 업로드 끝나서 http(s):// URL 이 있는 경우 → 서버 ONNX 추론 시도, 실패 시 mock
 *
 * 호출 측은 가능하면 업로드 후 URL 을 같이 넘겨주는 게 좋다.
 */
export async function classifyClothing(
  imageUri: string,
  serverUrl?: string,
): Promise<ClassificationResult> {
  // 1) 온디바이스 TFLite (현재 비활성, EAS dev build 시 활성화)
  const model = await loadModel();
  if (model) {
    // 실제 추론 경로 — 이미지 전처리 (224×224, ImageNet normalize) 가 아직 미구현이라
    // 현재는 mock 으로 폴백. EAS dev build 시점에 expo-image-manipulator 로 보강.
    return mockClassify();
  }

  // 2) 서버 추론 (현재 기본 경로)
  if (serverUrl) {
    const r = await classifyOnServer(serverUrl);
    if (r) return r;
  }

  // 3) mock 폴백
  return mockClassify();
}

// labels.ts 의 라벨은 mock 출력 검증 및 UI Pill 표시에서 쓰인다.
export const _unused = { CATEGORIES, COLORS, STYLES };
