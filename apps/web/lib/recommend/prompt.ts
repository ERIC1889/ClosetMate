import type { Candidate } from './candidate_generator';
import type { Clothes } from '@/lib/db/schema';

export type PromptContext = {
  query: string;
  occasion?: string | null;
  weather?: { tempC: number; condition: string } | null;
  candidates: Candidate[];
  wardrobeMap: Map<string, Clothes>;
};

export const SYSTEM_PROMPT = `당신은 사용자의 개인 스타일리스트입니다.
주어진 후보 조합 중에서 사용자의 요청, 날씨, 상황(occasion)에 가장 적합한 코디 1~3개를 골라
각각에 대한 친근한 한국어 이유를 작성하세요.

규칙:
- 후보에 없는 옷 ID는 절대 만들지 마세요.
- 각 추천에 score(0~1)를 매기세요.
- 전체 응답에 대한 model_confidence(0~1)를 솔직하게 매기세요.
  확신이 없으면 0.7 미만으로 보고하세요.
- 응답은 반드시 정해진 JSON 스키마를 따르세요.`;

function describeItem(c: Clothes): string {
  return `${c.id} (${c.category}, ${c.color}, ${c.style}${c.brand ? `, ${c.brand}` : ''})`;
}

export function buildUserPrompt(ctx: PromptContext): string {
  const lines: string[] = [];
  lines.push(`사용자 요청: "${ctx.query}"`);
  if (ctx.occasion) lines.push(`Occasion: ${ctx.occasion}`);
  if (ctx.weather) {
    lines.push(`날씨: ${ctx.weather.tempC}°C, ${ctx.weather.condition}`);
  }
  lines.push('');
  lines.push('후보 조합:');
  ctx.candidates.forEach((cand, i) => {
    const items = cand.clothesIds
      .map((id) => ctx.wardrobeMap.get(id))
      .filter((x): x is Clothes => Boolean(x))
      .map(describeItem)
      .join(' + ');
    const hints = cand.reasonHints.length
      ? ` [힌트: ${cand.reasonHints.join(', ')}]`
      : '';
    lines.push(`${i + 1}. [${cand.clothesIds.join(',')}] ${items}${hints}`);
  });
  return lines.join('\n');
}
