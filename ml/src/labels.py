"""분류기 라벨 정의 — 모바일 앱 lib/labels.ts와 동일한 순서를 유지해야 함."""

CATEGORIES = ["top", "bottom", "outer", "dress", "shoes", "bag", "acc"]
COLORS = [
    "white", "black", "gray", "beige", "navy",
    "blue", "red", "green", "yellow", "pink", "brown",
]
STYLES = ["casual", "formal", "sporty", "street", "minimal"]

NUM_CATEGORIES = len(CATEGORIES)
NUM_COLORS = len(COLORS)
NUM_STYLES = len(STYLES)
