// 분류기 출력 인덱스 → 라벨 매핑.
// ml/src/labels.py 와 apps/mobile/lib/labels.ts 와 반드시 동일한 순서를 유지해야 한다.

export const CATEGORIES = [
  'top', 'bottom', 'outer', 'dress', 'shoes', 'bag', 'acc',
] as const;

export const COLORS = [
  'white', 'black', 'gray', 'beige', 'navy',
  'blue', 'red', 'green', 'yellow', 'pink', 'brown',
] as const;

export const STYLES = ['casual', 'formal', 'sporty', 'street', 'minimal'] as const;

export type Category = (typeof CATEGORIES)[number];
export type Color = (typeof COLORS)[number];
export type Style = (typeof STYLES)[number];
