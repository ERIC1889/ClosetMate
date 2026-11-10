import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';

import { Button, Card, Pill, Text, useTheme, CATEGORY_COLORS } from '@/components/ui';
import { api, type ClothesItem } from '@/lib/api';
import { useApp } from '@/lib/store';
import { SPACING, RADIUS } from '@/constants/Colors';
import { useVoiceRecorder, formatDuration } from '@/lib/voice';

type Reco = {
  clothes_ids: string[];
  reason: string;
  score: number;
};

const QUICK_PROMPTS = [
  { emoji: '💼', label: '회사 출근' },
  { emoji: '☕', label: '카페 약속' },
  { emoji: '🌧️', label: '비 오는 날' },
  { emoji: '🏃', label: '운동하러' },
  { emoji: '🎬', label: '데이트' },
  { emoji: '🎉', label: '파티' },
];

export default function RecommendScreen() {
  const t = useTheme();
  const userId = useApp((s) => s.userId);
  const prompt = useApp((s) => s.recommendPrompt);
  const setPrompt = useApp((s) => s.setRecommendPrompt);
  const setLastReco = useApp((s) => s.setLastRecommendation);
  const [useLocation, setUseLocation] = useState(false);
  const voice = useVoiceRecorder();
  const qc = useQueryClient();

  const wardrobe = useQuery({
    queryKey: ['wardrobe'],
    queryFn: () => api.listWardrobe(),
    enabled: !!userId,
  });
  const itemMap = new Map<string, ClothesItem>(
    (wardrobe.data?.items ?? []).map((i) => [i.id, i]),
  );

  const reco = useMutation({
    mutationFn: async () => {
      let location: { lat: number; lng: number } | null = null;
      if (useLocation) {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({});
          location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        }
      }
      return api.recommend({
        query: prompt,
        context: { location, occasion: null },
      });
    },
    onSuccess: (data) => {
      const first = data.recommendations[0];
      if (first) {
        setLastReco({
          reason: first.reason,
          clothesIds: first.clothes_ids,
          score: first.score,
        });
      }
    },
  });

  const onMic = async () => {
    // 첫 탭: 녹음 시작, 두 번째 탭: 녹음 종료 → Whisper 전송
    if (voice.state === 'transcribing') return;
    if (voice.state === 'recording') {
      const uri = await voice.stop();
      if (!uri) return;
      voice.setTranscribing(true);
      try {
        const res = await api.voiceFromUri(uri);
        if (res.transcript) setPrompt(res.transcript);
      } catch (e) {
        console.warn('[voice] transcribe failed', e);
      } finally {
        voice.setTranscribing(false);
      }
    } else {
      await voice.start();
    }
  };

  const isRecording = voice.state === 'recording';
  const isTranscribing = voice.state === 'transcribing';
  const isUnsupported = voice.state === 'unsupported';

  const errMsg = reco.error instanceof Error ? reco.error.message : null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.background }}
      contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.md }}
      keyboardShouldPersistTaps="handled"
    >
      <Card>
        <Text weight="bold" size={16}>오늘 뭐 입을까요?</Text>
        <Text tone="muted" size={13} style={{ marginTop: 4 }}>
          상황만 적으면 AI가 어울리는 조합을 찾아드려요.
        </Text>

        <View
          style={[
            s.inputRow,
            {
              borderColor: isRecording ? t.danger : t.border,
              backgroundColor: t.surfaceMuted,
            },
          ]}
        >
          <TextInput
            placeholder={isRecording ? '듣는 중...' : '예: 비 오는 날 카페 갈건데...'}
            placeholderTextColor={t.textMuted}
            style={{ flex: 1, color: t.text, fontSize: 15, paddingVertical: 8, minHeight: 36 }}
            value={prompt}
            onChangeText={setPrompt}
            editable={!isRecording && !isTranscribing}
            multiline
          />
          <Pressable
            onPress={onMic}
            disabled={isUnsupported || isTranscribing}
            style={({ pressed }) => [
              s.micBtn,
              {
                backgroundColor: isRecording
                  ? t.danger
                  : isTranscribing
                    ? t.surfaceMuted
                    : t.brand,
                opacity: isUnsupported ? 0.4 : pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text tone="invert" weight="bold" size={14}>
              {isRecording ? '■' : isTranscribing ? '…' : '🎙'}
            </Text>
          </Pressable>
        </View>

        {isRecording && (
          <RecordingIndicator durationMillis={voice.durationMillis} />
        )}
        {isTranscribing && (
          <View style={[s.statusRow, { backgroundColor: t.surfaceMuted }]}>
            <Text size={12} tone="muted">✨ 음성을 텍스트로 변환 중...</Text>
          </View>
        )}
        {isUnsupported && voice.error && (
          <View style={[s.statusRow, { backgroundColor: t.surfaceMuted }]}>
            <Text size={12} tone="danger">{voice.error}</Text>
          </View>
        )}

        {/* Quick prompt chips */}
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: SPACING.sm }}
        >
          {QUICK_PROMPTS.map((q) => (
            <Pill
              key={q.label}
              label={`${q.emoji} ${q.label}`}
              selected={prompt === q.label}
              onPress={() => setPrompt(q.label)}
            />
          ))}
        </View>

        <Pressable
          onPress={() => setUseLocation((v) => !v)}
          style={{
            marginTop: SPACING.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <View
            style={{
              width: 18,
              height: 18,
              borderRadius: 4,
              borderWidth: 2,
              borderColor: useLocation ? t.brand : t.border,
              backgroundColor: useLocation ? t.brand : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {useLocation ? (
              <Text size={11} weight="bold" tone="invert">✓</Text>
            ) : null}
          </View>
          <Text size={13} tone="muted">위치 기반 날씨 반영</Text>
        </Pressable>

        <Button
          title="추천 받기"
          onPress={() => reco.mutate()}
          loading={reco.isPending}
          disabled={!prompt.trim() || !userId}
          style={{ marginTop: SPACING.md }}
        />
        {errMsg && (
          <Text tone="danger" size={12} style={{ marginTop: 8 }}>
            {errMsg}
          </Text>
        )}
      </Card>

      {reco.isPending && (
        <Card>
          <Text size={13} tone="muted">AI가 옷장을 살펴보고 있어요...</Text>
        </Card>
      )}

      {reco.data && (
        <View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: SPACING.sm,
              paddingHorizontal: 2,
            }}
          >
            <Text size={16} weight="bold">결과</Text>
            <Text tone="muted" size={11}>
              {reco.data.model_used} · {reco.data.candidates_generated} 후보 · {reco.data.latency_ms}ms
            </Text>
          </View>
          {reco.data.recommendations.map((r: Reco, i: number) => (
            <RecoCard
              key={i}
              index={i}
              reco={r}
              itemMap={itemMap}
              onSaved={() => qc.invalidateQueries({ queryKey: ['wardrobe'] })}
            />
          ))}
          {reco.data.fallback_triggered && (
            <Text tone="muted" size={12} style={{ marginTop: 4, textAlign: 'center' }}>
              fallback: {reco.data.fallback_reason}
            </Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

function RecoCard({
  index,
  reco,
  itemMap,
  onSaved,
}: {
  index: number;
  reco: Reco;
  itemMap: Map<string, ClothesItem>;
  onSaved?: () => void;
}) {
  const t = useTheme();
  const items = reco.clothes_ids
    .map((id) => itemMap.get(id))
    .filter((x): x is ClothesItem => !!x);
  const save = useMutation({
    mutationFn: () =>
      api.saveOutfit({
        wornDate: new Date().toISOString().slice(0, 10),
        clothesIds: reco.clothes_ids,
        occasion: null,
        rating: null,
      }),
    onSuccess: () => onSaved?.(),
  });

  const scorePct = Math.round(reco.score * 100);
  const scoreColor = scorePct >= 80 ? t.brand : scorePct >= 60 ? t.accent : t.textMuted;

  return (
    <Card style={{ marginBottom: SPACING.md }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text weight="bold" size={15}>조합 #{index + 1}</Text>
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: RADIUS.pill,
            backgroundColor: scoreColor,
          }}
        >
          <Text size={11} weight="bold" tone="invert">매칭 {scorePct}%</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: SPACING.md }}
      >
        {items.map((it) => (
          <View key={it.id} style={{ marginRight: SPACING.sm, width: 88 }}>
            <View
              style={{
                width: 88,
                height: 88,
                borderRadius: RADIUS.md,
                overflow: 'hidden',
                backgroundColor: t.surfaceMuted,
              }}
            >
              <View
                style={{
                  height: 3,
                  backgroundColor: CATEGORY_COLORS[it.category] ?? t.brand,
                }}
              />
              <Image
                source={{ uri: it.imageUrl }}
                style={{ width: '100%', height: 85 }}
              />
            </View>
            <Text tone="muted" size={11} style={{ marginTop: 4 }} numberOfLines={1}>
              {it.category}
            </Text>
          </View>
        ))}
      </ScrollView>

      <Text size={13} style={{ marginTop: SPACING.md, lineHeight: 19 }}>
        {reco.reason}
      </Text>

      <Button
        title={save.isSuccess ? '✓ 기록됨' : '이거 입었어요'}
        variant={save.isSuccess ? 'secondary' : 'primary'}
        size="sm"
        loading={save.isPending}
        onPress={() => save.mutate()}
        style={{ marginTop: SPACING.md, alignSelf: 'flex-start' }}
      />
    </Card>
  );
}

function RecordingIndicator({ durationMillis }: { durationMillis: number }) {
  const t = useTheme();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.3,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View
      style={[
        s.statusRow,
        { backgroundColor: t.danger + '1A', borderColor: t.danger },
      ]}
    >
      <Animated.View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: t.danger,
          opacity: pulse,
        }}
      />
      <Text size={13} weight="bold" tone="danger">녹음중</Text>
      <Text size={13} tone="muted" style={{ marginLeft: 'auto' }}>
        {formatDuration(durationMillis)}
      </Text>
      <Text size={11} tone="muted">탭하면 종료</Text>
    </View>
  );
}

const s = StyleSheet.create({
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
});
