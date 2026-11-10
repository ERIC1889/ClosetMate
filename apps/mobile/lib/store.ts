import { create } from 'zustand';

// 글로벌 UI 상태. 서버 데이터는 react-query 가 캐싱한다.
type State = {
  userId: string | null;
  setUserId: (id: string | null) => void;

  // 추천 화면 prompt — 음성 인식 결과를 이 상태로 흘려 보낸다.
  recommendPrompt: string;
  setRecommendPrompt: (q: string) => void;

  // 옷장 카테고리 필터.
  wardrobeFilter: string | null;
  setWardrobeFilter: (c: string | null) => void;

  // 마지막 추천 결과(홈 미리보기용).
  lastRecommendation: { reason: string; clothesIds: string[]; score: number } | null;
  setLastRecommendation: (r: State['lastRecommendation']) => void;
};

export const useApp = create<State>((set) => ({
  userId: null,
  setUserId: (id) => set({ userId: id }),

  recommendPrompt: '',
  setRecommendPrompt: (q) => set({ recommendPrompt: q }),

  wardrobeFilter: null,
  setWardrobeFilter: (c) => set({ wardrobeFilter: c }),

  lastRecommendation: null,
  setLastRecommendation: (r) => set({ lastRecommendation: r }),
}));
