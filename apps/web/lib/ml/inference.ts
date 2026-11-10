import path from 'node:path';
import { InferenceSession, Tensor } from 'onnxruntime-node';
import sharp from 'sharp';

import { CATEGORIES, COLORS, STYLES } from './labels';

// 서버 사이드 ONNX 추론. 모바일이 Expo Go 일 때 TFLite native module 을 쓸 수 없으므로
// 학습된 모델을 서버에서 돌리고 결과만 모바일에 돌려준다 (spec 의 온디바이스에서 한 단계 벗어남).
// EAS dev build 가 나오면 모바일 측 lib/ml.ts 에서 직접 추론하도록 다시 갈아끼우면 된다.

const MODEL_FILENAME = 'fashion_classifier.onnx';
const MODEL_VERSION = 'mobilenet_v3_small-onnx-v1';

// ImageNet 정규화 (학습 시 동일)
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

let _session: Promise<InferenceSession> | null = null;
function getSession(): Promise<InferenceSession> {
  if (_session) return _session;
  const modelPath = path.join(process.cwd(), 'ml-models', MODEL_FILENAME);
  _session = InferenceSession.create(modelPath);
  return _session;
}

function softmax(logits: Float32Array | number[]): number[] {
  let max = -Infinity;
  for (const v of logits) if (v > max) max = v;
  const exps = Array.from(logits, (v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / sum);
}

function argmax(arr: number[]): { idx: number; conf: number } {
  let bestIdx = 0;
  let bestVal = -Infinity;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > bestVal) {
      bestVal = arr[i];
      bestIdx = i;
    }
  }
  return { idx: bestIdx, conf: bestVal };
}

async function imageToTensor(buf: Buffer): Promise<Tensor> {
  // 224x224 RGB raw pixels (uint8)
  const { data, info } = await sharp(buf)
    .resize(224, 224, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.channels !== 3 || info.width !== 224 || info.height !== 224) {
    throw new Error(
      `unexpected image shape: ${info.width}x${info.height}x${info.channels}`,
    );
  }

  // HWC uint8 → CHW float32, normalized.
  // PyTorch 입력 shape: [1, 3, 224, 224].
  const C = 3, H = 224, W = 224;
  const float = new Float32Array(C * H * W);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const srcIdx = (y * W + x) * 3;
      const r = data[srcIdx] / 255;
      const g = data[srcIdx + 1] / 255;
      const b = data[srcIdx + 2] / 255;
      const dstBase = y * W + x;
      float[0 * H * W + dstBase] = (r - MEAN[0]) / STD[0];
      float[1 * H * W + dstBase] = (g - MEAN[1]) / STD[1];
      float[2 * H * W + dstBase] = (b - MEAN[2]) / STD[2];
    }
  }
  return new Tensor('float32', float, [1, C, H, W]);
}

export type ClassifyOutput = {
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
  latencyMs: number;
};

export async function classifyImageBuffer(buf: Buffer): Promise<ClassifyOutput> {
  const start = Date.now();
  const session = await getSession();
  const input = await imageToTensor(buf);

  // ONNX export 시 output_names=["category","color","style"] 지정했음.
  const feeds: Record<string, Tensor> = { [session.inputNames[0]]: input };
  const outputs = await session.run(feeds);

  const catLogits = Array.from(outputs[session.outputNames[0]].data as Float32Array);
  const colLogits = Array.from(outputs[session.outputNames[1]].data as Float32Array);
  const styLogits = Array.from(outputs[session.outputNames[2]].data as Float32Array);

  const cat = argmax(softmax(catLogits));
  const col = argmax(softmax(colLogits));
  const sty = argmax(softmax(styLogits));

  return {
    category: CATEGORIES[cat.idx],
    color: COLORS[col.idx],
    style: STYLES[sty.idx],
    confidence: {
      category: cat.conf,
      color: col.conf,
      style: sty.conf,
      min: Math.min(cat.conf, col.conf, sty.conf),
    },
    modelVersion: MODEL_VERSION,
    latencyMs: Date.now() - start,
  };
}

export async function classifyImageUrl(url: string): Promise<ClassifyOutput> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetch_image_failed:${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return classifyImageBuffer(buf);
}
