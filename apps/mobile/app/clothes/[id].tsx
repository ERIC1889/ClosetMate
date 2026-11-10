import { useMemo, useState } from 'react';
import { Alert, Image, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button, Card, Divider, Pill, Text, useTheme } from '@/components/ui';
import { api, type ClothesItem } from '@/lib/api';
import { CATEGORIES, COLORS, STYLES } from '@/lib/labels';
import { SPACING, RADIUS } from '@/constants/Colors';

const CATEGORY_LABEL: Record<string, string> = {
  top: '상의', bottom: '하의', outer: '아우터', dress: '원피스',
  shoes: '신발', bag: '가방', acc: '액세서리',
};

export default function ClothesDetailScreen() {
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  // 옷장 캐시에서 우선 가져오고, 없으면 직접 fetch
  const cached = useMemo(() => {
    const data = qc.getQueryData<{ items: ClothesItem[] }>(['wardrobe']);
    return data?.items.find((c) => c.id === id) ?? null;
  }, [id, qc]);

  const detail = useQuery({
    queryKey: ['clothes', id],
    queryFn: () => api.getClothes(id!),
    enabled: !!id && !cached,
    initialData: cached ?? undefined,
  });

  const item = detail.data;
  const [category, setCategory] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [style, setStyle] = useState<string | null>(null);

  const cur = {
    category: category ?? item?.category ?? '',
    color: color ?? item?.color ?? '',
    style: style ?? item?.style ?? '',
  };

  const dirty =
    !!item &&
    (cur.category !== item.category || cur.color !== item.color || cur.style !== item.style);

  const update = useMutation({
    mutationFn: () => api.updateClothes(id!, cur),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wardrobe'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['clothes', id] });
      router.back();
    },
  });

  const remove = useMutation({
    mutationFn: () => api.deleteClothes(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wardrobe'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      router.back();
    },
  });

  const confirmDelete = () => {
    Alert.alert('이 옷을 삭제할까요?', '삭제된 옷은 통계와 추천에서 빠집니다.', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => remove.mutate() },
    ]);
  };

  if (!item) {
    return (
      <View style={{ flex: 1, backgroundColor: t.background, padding: SPACING.lg }}>
        <Text tone="muted">불러오는 중...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.background }}
      contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.md }}
    >
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
          source={{ uri: item.imageUrl }}
          style={{ width: '100%', aspectRatio: 1, backgroundColor: t.surfaceMuted }}
          resizeMode="cover"
        />
      </View>

      <LabelPicker
        title="카테고리"
        options={CATEGORIES as unknown as string[]}
        value={cur.category}
        onChange={setCategory}
        labelMap={CATEGORY_LABEL}
      />
      <LabelPicker
        title="색상"
        options={COLORS as unknown as string[]}
        value={cur.color}
        onChange={setColor}
      />
      <LabelPicker
        title="스타일"
        options={STYLES as unknown as string[]}
        value={cur.style}
        onChange={setStyle}
      />

      <Card>
        <Text weight="bold" size={14}>AI 분석</Text>
        <Divider />
        <Text size={12} tone="muted">
          신뢰도 {Math.round((item.aiConfidence ?? 0) * 100)}%
          {item.userCorrected ? ' · 사용자 수정됨' : ''}
        </Text>
        <Text size={12} tone="muted" style={{ marginTop: 4 }}>
          착용 {item.wearCount}회
          {item.lastWornAt ? ` · 마지막 ${new Date(item.lastWornAt).toLocaleDateString('ko-KR')}` : ''}
        </Text>
      </Card>

      <Button
        title={dirty ? '저장' : '변경 없음'}
        onPress={() => update.mutate()}
        loading={update.isPending}
        disabled={!dirty || update.isPending}
        size="lg"
      />
      <Button
        title="삭제"
        variant="danger"
        size="md"
        loading={remove.isPending}
        onPress={confirmDelete}
      />
    </ScrollView>
  );
}

function LabelPicker({
  title,
  options,
  value,
  onChange,
  labelMap,
}: {
  title: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  labelMap?: Record<string, string>;
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
          <Pill
            key={o}
            label={labelMap?.[o] ?? o}
            selected={o === value}
            onPress={() => onChange(o)}
          />
        ))}
      </View>
    </Card>
  );
}
