import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { Card, Pill, Text, useTheme, CATEGORY_COLORS } from '@/components/ui';
import { api, type ClothesItem } from '@/lib/api';
import { useApp } from '@/lib/store';
import { SPACING, RADIUS } from '@/constants/Colors';

const CATS: { key: string; label: string }[] = [
  { key: 'top', label: '상의' },
  { key: 'bottom', label: '하의' },
  { key: 'outer', label: '아우터' },
  { key: 'dress', label: '원피스' },
  { key: 'shoes', label: '신발' },
  { key: 'bag', label: '가방' },
  { key: 'acc', label: '액세서리' },
];

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATS.map((c) => [c.key, c.label]),
);

export default function WardrobeScreen() {
  const t = useTheme();
  const router = useRouter();
  const filter = useApp((s) => s.wardrobeFilter);
  const setFilter = useApp((s) => s.setWardrobeFilter);
  const userId = useApp((s) => s.userId);

  const q = useQuery({
    queryKey: ['wardrobe'],
    queryFn: () => api.listWardrobe(),
    enabled: !!userId,
  });

  const allItems = q.data?.items ?? [];
  const items = useMemo(
    () => (filter ? allItems.filter((c) => c.category === filter) : allItems),
    [allItems, filter],
  );

  // 카테고리별 카운트 (chip 옆에 작은 숫자)
  const countByCat = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of allItems) m[it.category] = (m[it.category] ?? 0) + 1;
    return m;
  }, [allItems]);

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      {/* 헤더 — 총 개수 */}
      <View style={{ paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg }}>
        <Text size={13} tone="muted">전체 {allItems.length}벌</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: SPACING.sm, marginHorizontal: -SPACING.lg, paddingHorizontal: SPACING.lg }}
        >
          <Pill
            label={`전체 ${allItems.length}`}
            selected={filter === null}
            onPress={() => setFilter(null)}
          />
          {CATS.map((c) => (
            <Pill
              key={c.key}
              label={countByCat[c.key] ? `${c.label} ${countByCat[c.key]}` : c.label}
              selected={filter === c.key}
              onPress={() => setFilter(filter === c.key ? null : c.key)}
            />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={items}
        keyExtractor={(c) => c.id}
        numColumns={2}
        contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.md }}
        columnWrapperStyle={{ gap: SPACING.md }}
        refreshControl={
          <RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} />
        }
        ListEmptyComponent={
          q.isLoading ? null : (
            <Card style={{ marginTop: SPACING.lg }}>
              <Text weight="medium">
                {filter
                  ? `${CATEGORY_LABEL[filter] ?? filter} 에 옷이 없어요`
                  : '아직 옷이 없어요'}
              </Text>
              <Text tone="muted" size={13} style={{ marginTop: 4 }}>
                오른쪽 아래 + 버튼으로 첫 옷을 등록해 보세요.
              </Text>
            </Card>
          )
        }
        renderItem={({ item }) => (
          <ClothesCard
            item={item}
            onPress={() => router.push(`/clothes/${item.id}` as never)}
          />
        )}
      />

      <Pressable
        onPress={() => router.push('/add-clothes')}
        style={({ pressed }) => [
          s.fab,
          { backgroundColor: t.brand, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text size={28} weight="bold" tone="invert" style={{ lineHeight: 32 }}>
          +
        </Text>
      </Pressable>
    </View>
  );
}

function ClothesCard({ item, onPress }: { item: ClothesItem; onPress?: () => void }) {
  const t = useTheme();
  const catColor = CATEGORY_COLORS[item.category] ?? t.brand;
  const lowConf = (item.aiConfidence ?? 1) < 0.5 && !item.userCorrected;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: t.surface,
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: t.border,
        overflow: 'hidden',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {/* 카테고리 컬러 스트라이프 */}
      <View style={{ height: 4, backgroundColor: catColor }} />

      <View>
        <Image
          source={{ uri: item.imageUrl }}
          style={{ width: '100%', aspectRatio: 1, backgroundColor: t.surfaceMuted }}
        />

        {/* 우상단 wear count 배지 */}
        {item.wearCount > 0 && (
          <View
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: RADIUS.pill,
              backgroundColor: 'rgba(0,0,0,0.7)',
            }}
          >
            <Text size={11} weight="bold" tone="invert">
              {item.wearCount}회
            </Text>
          </View>
        )}

        {/* 좌상단 신뢰도 경고 */}
        {lowConf && (
          <View
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: RADIUS.pill,
              backgroundColor: t.accent,
            }}
          >
            <Text size={11} weight="bold" tone="invert">
              확인 필요
            </Text>
          </View>
        )}
      </View>

      <View style={{ padding: SPACING.md }}>
        <Text size={13} weight="medium" numberOfLines={1}>
          {CATEGORY_LABEL[item.category] ?? item.category}
        </Text>
        <Text tone="muted" size={11} style={{ marginTop: 2 }} numberOfLines={1}>
          {item.color} · {item.style}
        </Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: SPACING.lg,
    bottom: SPACING.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
