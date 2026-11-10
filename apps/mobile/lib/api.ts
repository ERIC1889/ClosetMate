import * as FileSystem from 'expo-file-system/legacy';

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// 인증 헤더를 한 곳에서 관리한다.
// MVP: 모바일 앱이 보유한 userId 를 x-user-id 헤더로 전달.
// 부트 시 lib/userId.ts → setApiUserId() 로 한 번 채워준다.
// Clerk 도입 후에는 토큰 기반으로 대체한다.
let _userId: string | null = null;
export function setApiUserId(id: string | null) {
  _userId = id;
}
export function getApiUserId(): string | null {
  return _userId;
}

function authHeaders(): Record<string, string> {
  return _userId ? { 'x-user-id': _userId } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export type ClothesItem = {
  id: string;
  imageUrl: string;
  category: string;
  color: string;
  style: string;
  brand?: string | null;
  aiConfidence?: number | null;
  userCorrected?: boolean;
  wearCount: number;
  lastWornAt?: string | null;
};

export type MeUser = {
  id: string;
  clerkId: string;
  email: string;
  name?: string | null;
  stylePreferences?: Record<string, unknown> | null;
  createdAt: string;
};

export const api = {
  // 앱 부트 시 호출: 서버에 users row 가 없으면 만들고, 있으면 그대로 받아온다.
  ensureMe(payload?: { email?: string; name?: string }) {
    return request<MeUser>('/api/users/me', {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    });
  },

  listWardrobe() {
    return request<{ items: ClothesItem[]; total: number }>('/api/wardrobe');
  },

  createClothes(payload: {
    imageUrl: string;
    category: string;
    color: string;
    style: string;
    aiConfidence?: number;
    aiPredicted?: unknown;
    userCorrected?: boolean;
    modelVersion?: string;
    brand?: string;
    price?: number;
    gptAnalysis?: Record<string, string>;
  }) {
    return request<ClothesItem>('/api/wardrobe', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getClothes(id: string) {
    return request<ClothesItem>(`/api/wardrobe/${id}`);
  },

  updateClothes(
    id: string,
    payload: Partial<{
      category: string;
      color: string;
      style: string;
      brand: string | null;
      price: number | null;
      userCorrected: boolean;
    }>,
  ) {
    return request<ClothesItem>(`/api/wardrobe/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteClothes(id: string) {
    return request<{ id: string; deletedAt: string }>(`/api/wardrobe/${id}`, {
      method: 'DELETE',
    });
  },

  recommend(payload: {
    query: string;
    context?: {
      occasion?: string | null;
      location?: { lat: number; lng: number } | null;
      calendarSummary?: Record<string, unknown> | null;
    };
  }) {
    return request<{
      recommendations: Array<{
        clothes_ids: string[];
        reason: string;
        score: number;
      }>;
      candidates_generated: number;
      model_used: string;
      model_confidence: number;
      fallback_triggered: boolean;
      fallback_reason?: string;
      tokens: { input: number; output: number };
      latency_ms: number;
    }>('/api/recommend', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // expo-file-system 의 uploadAsync 를 쓴다. RN fetch + FormData 는 iOS Expo Go 에서
  // ph:// 같은 photo asset URI 를 처리 못 해 "Unsupported FormDataPart" 가 난다.
  // FileSystem.uploadAsync 는 OS native uploader 라 그 케이스를 정상 처리한다.
  async voiceFromUri(uri: string, _filename = 'audio.m4a', contentType = 'audio/m4a') {
    const res = await FileSystem.uploadAsync(`${BASE}/api/voice`, uri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'audio',
      mimeType: contentType,
      parameters: {},
      headers: authHeaders(),
    });
    if (res.status >= 400) throw new Error(`API ${res.status}: ${res.body}`);
    return JSON.parse(res.body) as {
      transcript: string;
      language: string;
      model_used: string;
      latency_ms: number;
    };
  },

  async uploadImage(uri: string, _filename = 'image.jpg', contentType = 'image/jpeg') {
    const res = await FileSystem.uploadAsync(`${BASE}/api/blob/upload`, uri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType: contentType,
      parameters: {},
      headers: authHeaders(),
    });
    if (res.status >= 400) throw new Error(`upload ${res.status}: ${res.body}`);
    return JSON.parse(res.body) as { url: string; pathname: string; size: number };
  },

  analyzeImage(payload: { imageUrl: string; highDetail?: boolean }) {
    return request<{
      analysis: Record<string, string>;
      model_used: string;
      image_detail: 'low' | 'high';
      fallback_triggered: boolean;
      latency_ms: number;
    }>('/api/vision/analyze', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // 서버 사이드 MobileNetV3 추론. 모바일 native 모듈을 못 쓰는 동안 사용.
  classifyImage(payload: { imageUrl: string }) {
    return request<{
      category: string;
      color: string;
      style: string;
      confidence: { category: number; color: number; style: number; min: number };
      modelVersion: string;
      latencyMs: number;
    }>('/api/ml/classify', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  saveOutfit(payload: {
    wornDate: string;
    clothesIds: string[];
    weather?: Record<string, unknown> | null;
    occasion?: string | null;
    rating?: number | null;
  }) {
    return request('/api/outfits', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  analytics() {
    return request<{
      top_worn: Array<{ clothes_id: string; count: number }>;
      unworn_60d: Array<{ clothes_id: string; days: number }>;
      color_distribution: Record<string, number>;
      category_distribution: Record<string, number>;
      total_items: number;
    }>('/api/analytics');
  },
};
