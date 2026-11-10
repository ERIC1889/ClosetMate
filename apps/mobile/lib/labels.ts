// 분류기 출력 인덱스 → 라벨 매핑 (학습 시 동일 순서 유지)
export const CATEGORIES = [
  'top',
  'bottom',
  'outer',
  'dress',
  'shoes',
  'bag',
  'acc',
] as const;

export const COLORS = [
  'white',
  'black',
  'gray',
  'beige',
  'navy',
  'blue',
  'red',
  'green',
  'yellow',
  'pink',
  'brown',
] as const;

export const STYLES = ['casual', 'formal', 'sporty', 'street', 'minimal'] as const;

export type Category = (typeof CATEGORIES)[number];
export type Color = (typeof COLORS)[number];
export type Style = (typeof STYLES)[number];
