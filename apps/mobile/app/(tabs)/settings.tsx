import { ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { Card, Divider, Stat, Text, useTheme, styles as ui } from '@/components/ui';
import { api } from '@/lib/api';
import { useApp } from '@/lib/store';
import { SPACING } from '@/constants/Colors';

export default function SettingsScreen() {
  const t = useTheme();
  const userId = useApp((s) => s.userId);

  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api.ensureMe(),
    enabled: !!userId,
  });

  const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? '(unset → localhost:3000)';
  const useTflite = process.env.EXPO_PUBLIC_USE_REAL_TFLITE === 'true';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.background }}
      contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.md }}
    >
      <Card>
        <View style={ui.rowBetween}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: t.brandSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text size={20}>👤</Text>
          </View>
          <View style={{ flex: 1, marginLeft: SPACING.md }}>
            <Text weight="bold" size={15}>
              {me.data?.name ?? 'ClosetMate 사용자'}
            </Text>
            <Text size={12} tone="muted" numberOfLines={1}>
              {me.data?.email ?? '...'}
            </Text>
          </View>
        </View>
      </Card>

      <Card>
        <Text weight="bold" size={14}>분류 모델</Text>
        <Divider />
        <Stat label="활성 모델" value="MobileNetV3-Small" hint="ImageNet pretrained + multi-task heads" />
        <View style={{ height: SPACING.sm }} />
        <Field
          label="추론 경로"
          value={
            useTflite
              ? '온디바이스 TFLite (EAS dev build 필요)'
              : '서버 ONNX (현재 활성)'
          }
        />
        <Field
          label="비교 baseline"
          value="ResNet50 — 학습 완료, 모바일 미배포 (15× 큼)"
        />
      </Card>

      <Card>
        <Text weight="bold" size={14}>환경</Text>
        <Divider />
        <Field label="API URL" value={apiUrl} mono />
        <Field label="사용자 ID" value={userId ?? '(없음)'} mono />
      </Card>

      <Card>
        <Text weight="bold" size={14}>정보</Text>
        <Divider />
        <Text size={13} tone="muted" style={{ lineHeight: 19 }}>
          ClosetMate — AI 옷장 매니저.
          {'\n'}nano-first GPT 추천 + 온디바이스 멀티태스크 분류기.
          {'\n'}docs/03_ML_비교실험.md 에 모델 비교 결과 정리.
        </Text>
      </Card>
    </ScrollView>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={{ marginVertical: 6 }}>
      <Text size={12} tone="muted">{label}</Text>
      <Text
        size={14}
        style={{ marginTop: 2, fontFamily: mono ? 'SpaceMono' : undefined }}
        selectable
      >
        {value}
      </Text>
    </View>
  );
}
