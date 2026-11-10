import { useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Button, Card, Pill, Text, useTheme } from '@/components/ui';
import { api } from '@/lib/api';
import { classifyClothing } from '@/lib/ml';
import { CATEGORIES, COLORS, STYLES } from '@/lib/labels';
import { SPACING, RADIUS } from '@/constants/Colors';

type Picked = {
  uri: string;
  filename: string;
  mimeType: string;
};

type ClassifyState = {
  category: string;
  color: string;
  style: string;
  modelVersion: string;
  source: 'mock' | 'tflite' | 'server-onnx';
  minConfidence: number;
};

function sourceLabel(s: ClassifyState['source']): string {
  if (s === 'tflite') return '온디바이스 분류기';
  if (s === 'server-onnx') return 'MobileNetV3 분류';
  return '임시값 (서버 분류 대기 중)';
}

type VisionState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'ok'; analysis: Record<string, string> }
  | { status: 'error'; message: string };

export default function AddClothesScreen() {
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const [picked, setPicked] = useState<Picked | null>(null);
  const [labels, setLabels] = useState<ClassifyState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vision, setVision] = useState<VisionState>({ status: 'idle' });

  // 업로드 promise 를 ref 로 공유한다. 같은 사진에 대해 분류/Vision/저장이 동시에 호출돼도
  // 업로드는 한 번만 일어난다. setState 만 쓰면 race 로 두 번 업로드되는 경우가 있었음.
  const uploadPromiseRef = useRef<Promise<string> | null>(null);

  function startUploadOnce(p: Picked): Promise<string> {
    if (uploadPromiseRef.current) return uploadPromiseRef.current;
    const promise = api.uploadImage(p.uri, p.filename, p.mimeType).then((up) => up.url);
    uploadPromiseRef.current = promise;
    return promise;
  }

  const pickFrom = async (source: 'camera' | 'library') => {
    setError(null);
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('권한이 필요합니다.');
      return;
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            allowsEditing: false,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            allowsEditing: false,
          });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;

    const next: Picked = {
      uri: asset.uri,
      filename: asset.fileName ?? `clothes-${Date.now()}.jpg`,
      mimeType: asset.mimeType ?? 'image/jpeg',
    };
    setPicked(next);
    setVision({ status: 'idle' });
    uploadPromiseRef.current = null;

    // 1) mock 라벨로 폼 즉시 채움 (사용자가 곧바로 수정 가능)
    classifyClothing(asset.uri)
      .then((r) =>
        setLabels({
          category: r.category,
          color: r.color,
          style: r.style,
          modelVersion: r.modelVersion,
          source: r.source,
          minConfidence: r.confidence.min,
        }),
      )
      .catch((err) => console.warn('[add] mock classify failed', err));

    // 2) 업로드 + 서버 ONNX 분류만 백그라운드로 — Vision 은 사용자가 명시적으로 트리거.
    //    이렇게 해서 사진만 골라보고 뒤로가도 OpenAI Vision 비용이 발생하지 않는다.
    startUploadOnce(next)
      .then(async (url) => {
        try {
          const r = await classifyClothing(next.uri, url);
          if (r.source === 'server-onnx') {
            setLabels({
              category: r.category,
              color: r.color,
              style: r.style,
              modelVersion: r.modelVersion,
              source: r.source,
              minConfidence: r.confidence.min,
            });
          }
        } catch (e) {
          console.warn('[add] server classify failed', e);
        }
      })
      .catch((err) => {
        console.warn('[add] upload failed', err);
      });
  };

  const runVision = async () => {
    if (!picked || vision.status === 'pending') return;
    setVision({ status: 'pending' });
    try {
      const url = await startUploadOnce(picked);
      const v = await api.analyzeImage({ imageUrl: url });
      setVision({ status: 'ok', analysis: v.analysis });
    } catch (err) {
      setVision({
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!picked || !labels) throw new Error('이미지와 라벨이 필요합니다.');
      // upload promise 가 이미 시작됐다 — 끝났든 아니든 같은 promise 를 await 해서 두 번 업로드 방지.
      const url = await startUploadOnce(picked);
      return api.createClothes({
        imageUrl: url,
        category: labels.category,
        color: labels.color,
        style: labels.style,
        modelVersion: labels.modelVersion,
        aiConfidence: labels.minConfidence,
        aiPredicted: {
          category: labels.category,
          color: labels.color,
          style: labels.style,
          source: labels.source,
        },
        gptAnalysis: vision.status === 'ok' ? vision.analysis : undefined,
        userCorrected: false,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wardrobe'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      router.back();
    },
    onError: (err) => setError(err instanceof Error ? err.message : String(err)),
  });

  const resetPicked = () => {
    setPicked(null);
    setLabels(null);
    setVision({ status: 'idle' });
    uploadPromiseRef.current = null;
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.background }}
      contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.md }}
      keyboardShouldPersistTaps="handled"
    >
      {!picked ? (
        <Card>
          <Text weight="bold" size={16}>사진 한 장으로 시작</Text>
          <Text tone="muted" size={13} style={{ marginTop: 4 }}>
            카메라 또는 사진첩에서 옷 사진을 골라주세요.
          </Text>
          <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md }}>
            <Button title="카메라" onPress={() => pickFrom('camera')} style={{ flex: 1 }} />
            <Button
              title="사진첩"
              variant="secondary"
              onPress={() => pickFrom('library')}
              style={{ flex: 1 }}
            />
          </View>
        </Card>
      ) : (
        <View
          style={{
            backgroundColor: t.surface,
            borderRadius: RADIUS.lg,
            borderWidth: 1,
            borderColor: t.border,
            overflow: 'hidden',
          }}
        >
          <Image
            source={{ uri: picked.uri }}
            style={{ width: '100%', aspectRatio: 1, backgroundColor: t.surfaceMuted }}
            resizeMode="cover"
          />
          <Pressable onPress={resetPicked} style={{ padding: SPACING.md, alignSelf: 'flex-end' }}>
            <Text tone="brand" size={13}>다시 고르기</Text>
          </Pressable>
        </View>
      )}

      {labels && (
        <>
          <LabelPicker
            title="카테고리"
            options={CATEGORIES as unknown as string[]}
            value={labels.category}
            onChange={(v) => setLabels({ ...labels, category: v })}
          />
          <LabelPicker
            title="색상"
            options={COLORS as unknown as string[]}
            value={labels.color}
            onChange={(v) => setLabels({ ...labels, color: v })}
          />
          <LabelPicker
            title="스타일"
            options={STYLES as unknown as string[]}
            value={labels.style}
            onChange={(v) => setLabels({ ...labels, style: v })}
          />
          <Card>
            {labels.source === 'mock' ? (
              <Text size={12} tone="muted">
                서버에서 분류 중... 라벨이 자동으로 갱신됩니다.
              </Text>
            ) : (
              <Text size={12} tone="brand">
                AI 분류 완료 — {sourceLabel(labels.source)} · 신뢰도{' '}
                {Math.round(labels.minConfidence * 100)}%
              </Text>
            )}
          </Card>

          {/* GPT Vision 분석 — 명시적 버튼으로만 호출 (OpenAI 비용 절약) */}
          <Card>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text weight="bold" size={14}>GPT Vision 분석</Text>
              {vision.status === 'idle' && (
                <Button
                  title="분석하기"
                  variant="secondary"
                  size="sm"
                  onPress={runVision}
                />
              )}
              {vision.status === 'pending' && (
                <Text size={12} tone="muted">분석 중...</Text>
              )}
              {vision.status === 'error' && (
                <Button title="다시 시도" variant="secondary" size="sm" onPress={runVision} />
              )}
            </View>

            {vision.status === 'idle' && (
              <Text tone="muted" size={12} style={{ marginTop: 8 }}>
                소재/패턴/핏을 GPT로 분석합니다. 호출 시점에만 비용 발생.
              </Text>
            )}
            {vision.status === 'error' && (
              <Text tone="danger" size={12} style={{ marginTop: 8 }}>
                실패: {vision.message}
              </Text>
            )}
            {vision.status === 'ok' &&
              Object.entries(vision.analysis).map(([k, v]) => (
                <View key={k} style={{ marginTop: 8 }}>
                  <Text size={12} tone="muted">{k}</Text>
                  <Text size={13} style={{ marginTop: 2 }}>{v}</Text>
                </View>
              ))}
          </Card>
        </>
      )}

      {error && (
        <Card>
          <Text tone="danger" size={13}>{error}</Text>
        </Card>
      )}

      <Button
        title="저장"
        onPress={() => save.mutate()}
        loading={save.isPending}
        disabled={!picked || !labels}
        size="lg"
      />
    </ScrollView>
  );
}

function LabelPicker({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Card>
      <Text weight="bold" size={14}>{title}</Text>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          marginTop: SPACING.sm,
        }}
      >
        {options.map((o) => (
          <Pill key={o} label={o} selected={o === value} onPress={() => onChange(o)} />
        ))}
      </View>
    </Card>
  );
}

const _s = StyleSheet.create({});
