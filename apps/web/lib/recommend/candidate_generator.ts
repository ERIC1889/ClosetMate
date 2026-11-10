import type { Clothes } from '@/lib/db/schema';

export type Weather = {
  tempC: number;
  condition: 'sunny' | 'cloudy' | 'rain' | 'snow';
};

export type CandidateInput = {
  wardrobe: Clothes[];
  weather?: Weather | null;
  occasion?: string | null;
  recentClothesIds?: string[];
};

export type Candidate = {
  clothesIds: string[];
  score: number;
  reasonHints: string[];
};

const NEUTRAL_COLORS = new Set(['white', 'black', 'gray', 'beige', 'navy']);

// 동일 라벨 체계: labels.ts 의 CATEGORIES 와 일치해야 한다.
// top/bottom/outer/dress/shoes/bag/acc.
function isWeatherCompatible(item: Clothes, weather?: Weather | null): boolean {
  if (!weather) return true;

  // 더운 날 outer 컷
  if (weather.tempC >= 28 && item.category === 'outer') return false;

  // 추운 날 민소매 컷
  if (weather.tempC <= 5 && item.category === 'top' && /sleeveless/i.test(item.style ?? '')) {
    return false;
  }

  // 추운 날 dress 단독 컷 (outer 와 함께 입을 수 있으므로 dress 자체는 통과)

  // 비/눈에는 sporty 신발 제외 처리는 하지 않음 (사용자 데이터가 부족)
  return true;
}

// style 라벨은 casual/formal/sporty/street/minimal 이라
// 키워드 매칭(coat/jacket) 대신 카테고리/style 조합으로 판정한다.
function isProtectiveOuter(item: Clothes): boolean {
  if (item.category !== 'outer') return false;
  if (item.style === 'sporty' || item.style === 'street') return true;
  if (item.style === 'casual' || item.style === 'minimal' || item.style === 'formal') return true;
  return true;
}

function colorMatchScore(a: Clothes, b: Clothes): number {
  if (NEUTRAL_COLORS.has(a.color) || NEUTRAL_COLORS.has(b.color)) return 0.9;
  if (a.color === b.color) return 0.7;
  return 0.5;
}

function styleMatchScore(a: Clothes, b: Clothes): number {
  return a.style === b.style ? 1.0 : 0.6;
}

function recencyPenalty(item: Clothes, recent: Set<string>): number {
  return recent.has(item.id) ? 0.3 : 1.0;
}

function pickTopN<T>(arr: T[], n: number, scoreFn: (x: T) => number): T[] {
  return [...arr]
    .sort((a, b) => scoreFn(b) - scoreFn(a))
    .slice(0, n);
}

function pushCandidate(
  candidates: Candidate[],
  ids: string[],
  score: number,
  hints: string[]
) {
  candidates.push({ clothesIds: ids, score, reasonHints: hints });
}

export function generateCandidates(input: CandidateInput): Candidate[] {
  const recent = new Set(input.recentClothesIds ?? []);

  const eligible = input.wardrobe.filter(
    (c) => c.deletedAt === null && isWeatherCompatible(c, input.weather)
  );

  const byCategory = (cat: string) => eligible.filter((c) => c.category === cat);

  const tops = pickTopN(byCategory('top'), 3, (c) => recencyPenalty(c, recent));
  const bottoms = pickTopN(byCategory('bottom'), 3, (c) => recencyPenalty(c, recent));
  const dresses = pickTopN(byCategory('dress'), 2, (c) => recencyPenalty(c, recent));
  const outers = pickTopN(
    byCategory('outer').filter((o) =>
      input.weather?.condition === 'rain' ? isProtectiveOuter(o) : true
    ),
    2,
    (c) => recencyPenalty(c, recent)
  );
  const shoes = pickTopN(byCategory('shoes'), 2, (c) => recencyPenalty(c, recent));
  const bags = pickTopN(byCategory('bag'), 2, (c) => recencyPenalty(c, recent));
  const accs = pickTopN(byCategory('acc'), 2, (c) => recencyPenalty(c, recent));

  const tempC = input.weather?.tempC ?? 20;
  const needOuter =
    input.weather?.condition === 'rain' ||
    input.weather?.condition === 'snow' ||
    tempC < 15;

  const candidates: Candidate[] = [];

  // 1) top + bottom (+shoes, +outer, +bag, +acc)
  for (const top of tops) {
    for (const bottom of bottoms) {
      const baseScore =
        colorMatchScore(top, bottom) *
        styleMatchScore(top, bottom) *
        recencyPenalty(top, recent) *
        recencyPenalty(bottom, recent);

      const shoeOptions = shoes.length > 0 ? shoes : [null];
      const outerOptions = needOuter && outers.length > 0 ? outers : [null];

      for (const shoe of shoeOptions) {
        for (const outer of outerOptions) {
          const ids = [top.id, bottom.id];
          let score = baseScore;
          const hints: string[] = [];

          if (shoe) {
            ids.push(shoe.id);
            score *= colorMatchScore(top, shoe);
          }
          if (outer) {
            ids.push(outer.id);
            score *= colorMatchScore(top, outer);
            hints.push(
              input.weather?.condition === 'rain'
                ? '비 대비 outer'
                : tempC < 10
                  ? '저온 대비 outer'
                  : '날씨 대비 outer',
            );
          }
          if (
            input.occasion === 'meeting' &&
            (top.style === 'formal' || bottom.style === 'formal')
          ) {
            score *= 1.1;
            hints.push('미팅 톤');
          }

          // bag/acc 는 선택지로만 살짝 더한다 (코어 조합에는 없어도 됨)
          pushCandidate(candidates, ids, score, hints);
          if (bags[0]) {
            pushCandidate(
              candidates,
              [...ids, bags[0].id],
              score * 0.97,
              [...hints, '가방 포함']
            );
          }
          if (accs[0]) {
            pushCandidate(
              candidates,
              [...ids, accs[0].id],
              score * 0.95,
              [...hints, '액세서리 포함']
            );
          }
        }
      }
    }
  }

  // 2) dress (+shoes, +outer, +bag, +acc) — dress 는 단독으로 코어가 된다
  for (const dress of dresses) {
    const baseScore = recencyPenalty(dress, recent);
    const shoeOptions = shoes.length > 0 ? shoes : [null];
    const outerOptions = needOuter && outers.length > 0 ? outers : [null];

    for (const shoe of shoeOptions) {
      for (const outer of outerOptions) {
        const ids = [dress.id];
        let score = baseScore;
        const hints: string[] = ['원피스 룩'];

        if (shoe) {
          ids.push(shoe.id);
          score *= colorMatchScore(dress, shoe);
        }
        if (outer) {
          ids.push(outer.id);
          score *= colorMatchScore(dress, outer);
          hints.push(
            input.weather?.condition === 'rain'
              ? '비 대비 outer'
              : tempC < 10
                ? '저온 대비 outer'
                : '날씨 대비 outer',
          );
        }
        if (
          input.occasion === 'meeting' &&
          (dress.style === 'formal' || dress.style === 'minimal')
        ) {
          score *= 1.1;
          hints.push('미팅 톤');
        }

        pushCandidate(candidates, ids, score, hints);
        if (bags[0]) {
          pushCandidate(
            candidates,
            [...ids, bags[0].id],
            score * 0.97,
            [...hints, '가방 포함']
          );
        }
      }
    }
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, 10);
}
