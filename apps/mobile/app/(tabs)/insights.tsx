import { useMemo } from 'react';
import { Image, RefreshControl, ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import {
  Card,
  EmptyState,
  SectionHeader,
  Stat,
  Text,
  useTheme,
  CATEGORY_COLORS,
  COLOR_SWATCHES,
} from '@/components/ui';
import { DonutChart, LegendRow } from '@/components/charts';
import { api, type ClothesItem } from '@/lib/api';
import { useApp } from '@/lib/store';
import { SPACING, RADIUS } from '@/constants/Colors';

const CATEGORY_LABEL: Record<string, string> = {
  top: '상의', bottom: '하의', outer: '아우터', dress: '원피스',
  shoes: '신발', bag: '가방', acc: '액세서리',
};

const COLOR_LABEL: Record<string, string> = {
  white: '화이트', black: '블랙', gray: '그레이', beige: '베이지',
  navy: '네이비', blue: '블루', red: '레드', green: '그린',
  yellow: '옐로우', pink: '핑크', brown: '브라운',
};

export default function InsightsScreen() {
  const t = useTheme();
  const userId = useApp((s) => s.userId);

  const analytics = useQuery({
    queryKey: ['analytics'],
    queryFn: () => api.analytics(),
    enabled: !!userId,
  });
  const wardrobe = useQuery({
    queryKey: ['wardrobe'],
    queryFn: () => api.listWardrobe(),
    enabled: !!userId,
  });

  const itemMap = useMemo(
    () => new Map((wardrobe.data?.items ?? []).map((c) => [c.id, c])),
    [wardrobe.data],
  );

  const refreshing = analytics.isFetching || wardrobe.isFetching;
  const refetch = () => {
    analytics.refetch();
    wardrobe.refetch();
  };

  if (!userId) {
    return (
      <View style={{ flex: 1, backgroundColor: t.background, padding: SPACING.lg }}>
        <Text tone="muted">사용자 정보 준비 중...</Text>
      </View>
    );
  }
  if (!analytics.data || !wardrobe.data) {
    return (
      <View style={{ flex: 1, backgroundColor: t.background, padding: SPACING.lg }}>
        <Text tone="muted">불러오는 중...</Text>
      </View>
    );
  }

  const { top_worn, unworn_60d, color_distribution, category_distribution, total_items } =
    analytics.data;
  const items = wardrobe.data.items;

  const totalWears = items.reduce((s, c) => s + c.wearCount, 0);
  const avgWears = items.length > 0 ? totalWears / items.length : 0;
  const wornCount = items.filter((c) => c.wearCount > 0).length;
  const utilizationPct = items.length > 0 ? Math.round((wornCount / items.length) * 100) : 0;
  const lowConfCount = items.filter((c) => (c.aiConfidence ?? 1) < 0.5).length;

  const catSegments = Object.entries(category_distribution)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({
      key: k,
      value: v,
      color: CATEGORY_COLORS[k] ?? t.brand,
      label: CATEGORY_LABEL[k] ?? k,
    }));

  const colorSegments = Object.entries(color_distribution)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({
      key: k,
      value: v,
      color: COLOR_SWATCHES[k] ?? '#888',
      label: COLOR_LABEL[k] ?? k,
    }));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.background }}
      contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} />}
    >
      {/* 헤더 통계 (4-up) */}
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <View style={{ width: '50%', marginBottom: SPACING.md }}>
            <Stat label="전체 옷" value={`${total_items}벌`} />
          </View>
          <View style={{ width: '50%', marginBottom: SPACING.md }}>
            <Stat
              label="활용률"
              value={`${utilizationPct}%`}
              hint={`${wornCount} / ${items.length} 입어봄`}
              tone={utilizationPct >= 60 ? 'brand' : utilizationPct >= 30 ? 'text' : 'accent'}
            />
          </View>
          <View style={{ width: '50%' }}>
            <Stat label="평균 착용" value={avgWears.toFixed(1)} hint="회/벌" />
          </View>
          <View style={{ width: '50%' }}>
            <Stat
              label="분류 확인 필요"
              value={lowConfCount}
              hint={lowConfCount > 0 ? '신뢰도 < 50%' : '없음'}
              tone={lowConfCount > 0 ? 'danger' : 'text'}
            />
          </View>
        </View>
      </Card>

      {/* 카테고리 도넛 */}
      <View>
        <SectionHeader title="카테고리 분포" subtitle="옷장 구성 비율" />
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <DonutChart
              segments={catSegments}
              size={140}
              thickness={20}
              center={
                <View style={{ alignItems: 'center' }}>
                  <Text size={26} weight="bold">{total_items}</Text>
                  <Text size={11} tone="muted">벌</Text>
                </View>
              }
            />
            <View style={{ flex: 1, marginLeft: SPACING.md }}>
              {catSegments.map((s) => (
                <LegendRow
                  key={s.key}
                  color={s.color}
                  label={s.label ?? s.key}
                  value={s.value}
                  total={total_items}
                />
              ))}
            </View>
          </View>
        </Card>
      </View>

      {/* 색상 분포 */}
      <View>
        <SectionHeader title="색상 분포" subtitle="자주 입는 톤" />
        <Card>
          {colorSegments.length === 0 ? (
            <EmptyState title="아직 데이터 없음" />
          ) : (
            colorSegments.map((s) => (
              <LegendRow
                key={s.key}
                color={s.color}
                label={s.label ?? s.key}
                value={s.value}
                total={total_items}
              />
            ))
          )}
        </Card>
      </View>

      {/* Top worn — 이미지 포함 */}
      <View>
        <SectionHeader title="자주 입는 옷" subtitle="가장 많이 착용한 Top 5" />
        <Card>
          {top_worn.length === 0 ? (
            <EmptyState
              title="아직 착장 기록이 없어요"
              description="추천을 받고 '이거 입었어요' 버튼을 눌러보세요."
            />
          ) : (
            top_worn.map((row, i) => {
              const c = itemMap.get(row.clothes_id);
              if (!c) return null;
              return (
                <View
                  key={row.clothes_id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginTop: i === 0 ? 0 : SPACING.sm,
                    paddingTop: i === 0 ? 0 : SPACING.sm,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: t.border,
                  }}
                >
                  <Text size={14} tone="muted" weight="bold" style={{ width: 24 }}>
                    {i + 1}
                  </Text>
                  <Image
                    source={{ uri: c.imageUrl }}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: RADIUS.sm,
                      backgroundColor: t.surfaceMuted,
                    }}
                  />
                  <View style={{ flex: 1, marginLeft: SPACING.md }}>
                    <Text size={13} weight="medium">
                      {CATEGORY_LABEL[c.category] ?? c.category} · {COLOR_LABEL[c.color] ?? c.color}
                    </Text>
                    <Text size={11} tone="muted" style={{ marginTop: 2 }}>
                      {c.style}
                    </Text>
                  </View>
                  <Text size={14} tone="brand" weight="bold">
                    {row.count}회
                  </Text>
                </View>
              );
            })
          )}
        </Card>
      </View>

      {/* 안 입은 옷 — 이미지 포함 mini gallery */}
      <View>
        <SectionHeader
          title="60일 이상 안 입은 옷"
          subtitle={`${unworn_60d.length}벌이 잠자고 있어요`}
        />
        <Card>
          {unworn_60d.length === 0 ? (
            <EmptyState title="모두 활발하게 입고 있어요!" />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {unworn_60d.slice(0, 12).map((row) => {
                const c = itemMap.get(row.clothes_id);
                if (!c) return null;
                return (
                  <View key={row.clothes_id} style={{ marginRight: SPACING.sm, width: 80 }}>
                    <Image
                      source={{ uri: c.imageUrl }}
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: RADIUS.md,
                        backgroundColor: t.surfaceMuted,
                      }}
                    />
                    <Text size={11} tone="muted" style={{ marginTop: 4 }} numberOfLines={1}>
                      {row.days < 0 ? '한 번도' : `${row.days}일째`}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </Card>
      </View>
    </ScrollView>
  );
}
