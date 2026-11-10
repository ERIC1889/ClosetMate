import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import {
  Button,
  Card,
  Stat,
  Text,
  useTheme,
  CATEGORY_COLORS,
  styles as ui,
} from '@/components/ui';
import { api, type ClothesItem } from '@/lib/api';
import { useApp } from '@/lib/store';
import { SPACING, RADIUS } from '@/constants/Colors';

function greetingFor(hour: number): { headline: string; emoji: string } {
  if (hour < 5) return { headline: '늦은 밤이에요', emoji: '🌙' };
  if (hour < 11) return { headline: '좋은 아침이에요', emoji: '🌤️' };
  if (hour < 17) return { headline: '안녕하세요', emoji: '👋' };
  if (hour < 21) return { headline: '좋은 저녁이에요', emoji: '🌆' };
  return { headline: '오늘도 수고하셨어요', emoji: '🌙' };
}

export default function HomeScreen() {
  const t = useTheme();
  const router = useRouter();
  const userId = useApp((s) => s.userId);
  const lastReco = useApp((s) => s.lastRecommendation);

  const wardrobe = useQuery({
    queryKey: ['wardrobe'],
    queryFn: () => api.listWardrobe(),
    enabled: !!userId,
  });

  const items = wardrobe.data?.items ?? [];
  const total = items.length;
  const lowConfidence = items.filter((i) => (i.aiConfidence ?? 1) < 0.5).length;
  const totalWears = items.reduce((s, c) => s + c.wearCount, 0);
  const lastRecoItems: ClothesItem[] = useMemo(() => {
    if (!lastReco) return [];
    const map = new Map(items.map((c) => [c.id, c]));
    return lastReco.clothesIds.map((id) => map.get(id)).filter((x): x is ClothesItem => !!x);
  }, [lastReco, items]);

  const greet = greetingFor(new Date().getHours());

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.background }}
      contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.md }}
    >
      <View>
        <Text size={28} weight="bold">{greet.headline} {greet.emoji}</Text>
        <Text tone="muted" size={14} style={{ marginTop: 4 }}>
          오늘 뭐 입을지 고민이라면 추천 받아보세요.
        </Text>
      </View>

      {/* 핵심 CTA */}
      <Card>
        <View style={[ui.rowBetween, { marginBottom: SPACING.sm }]}>
          <Text weight="bold" size={16}>오늘 코디 받기</Text>
          <Text size={20}>✨</Text>
        </View>
        <Text tone="muted" size={13}>
          날씨와 일정에 맞춰 1~3가지 조합을 골라드려요.
        </Text>
        <Button
          title="추천 받기"
          onPress={() => router.push('/(tabs)/recommend')}
          style={{ marginTop: SPACING.md }}
        />
      </Card>

      {/* Stat row */}
      <View style={[ui.row, { gap: SPACING.md }]}>
        <Card style={{ flex: 1 }} onPress={() => router.push('/(tabs)/wardrobe')}>
          <Stat label="옷장" value={`${total}벌`} hint={total === 0 ? '비어 있음' : '탭하여 보기'} />
        </Card>
        <Card style={{ flex: 1 }} onPress={() => router.push('/(tabs)/insights')}>
          <Stat
            label="누적 착장"
            value={totalWears}
            hint="회"
            tone={totalWears > 0 ? 'brand' : 'text'}
          />
        </Card>
      </View>

      {/* 빠른 옷 추가 */}
      <Card onPress={() => router.push('/add-clothes')}>
        <View style={ui.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text weight="bold" size={16}>+ 옷 추가</Text>
            <Text tone="muted" size={13} style={{ marginTop: 4 }}>
              사진 1장이면 AI가 자동 분류해드려요.
            </Text>
          </View>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: t.brandSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text size={20}>📸</Text>
          </View>
        </View>
      </Card>

      {/* 분류 확인 필요 알림 */}
      {lowConfidence > 0 && (
        <Card onPress={() => router.push('/(tabs)/wardrobe')}>
          <View style={ui.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text weight="medium">분류 확인 필요</Text>
              <Text tone="muted" size={13} style={{ marginTop: 4 }}>
                AI 신뢰도가 낮은 옷이 {lowConfidence}개 있어요. 옷장에서 직접 라벨을 다듬어 주세요.
              </Text>
            </View>
            <Text size={16}>⚠️</Text>
          </View>
        </Card>
      )}

      {/* 최근 추천 미리보기 */}
      {lastReco && lastRecoItems.length > 0 && (
        <View>
          <Text size={14} weight="bold" style={{ marginBottom: SPACING.sm }}>최근 추천</Text>
          <Card>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {lastRecoItems.map((c) => (
                <View key={c.id} style={{ marginRight: SPACING.sm }}>
                  <Image
                    source={{ uri: c.imageUrl }}
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: RADIUS.md,
                      backgroundColor: t.surfaceMuted,
                    }}
                  />
                </View>
              ))}
            </ScrollView>
            <Text size={13} style={{ marginTop: SPACING.sm }} numberOfLines={2}>
              {lastReco.reason}
            </Text>
            <Text tone="brand" size={12} weight="medium" style={{ marginTop: 6 }}>
              매칭도 {(lastReco.score * 100).toFixed(0)}%
            </Text>
          </Card>
        </View>
      )}

      {/* 옷장 비어있을 때 가이드 */}
      {total === 0 && userId && (
        <Card>
          <Text weight="medium">시작하기</Text>
          <Text tone="muted" size={13} style={{ marginTop: 4 }}>
            옷장에 4벌 이상 등록하면 추천을 받을 수 있어요. 위 "+ 옷 추가" 를 눌러 시작해보세요.
          </Text>
        </Card>
      )}

      {!userId && (
        <Card>
          <Text tone="muted" size={13}>사용자 정보 준비 중...</Text>
        </Card>
      )}
    </ScrollView>
  );
}
