"""Fashion Product Images Dataset 로더.

Kaggle: https://www.kaggle.com/datasets/paramaggarwal/fashion-product-images-dataset
다운로드 후 `ml/data/raw/` 아래에 압축 해제하면 됨:
    ml/data/raw/images/<id>.jpg
    ml/data/raw/styles.csv
"""

from __future__ import annotations

from pathlib import Path
from typing import Callable, Optional

import pandas as pd
import torch
from PIL import Image
from torch.utils.data import Dataset

from .labels import CATEGORIES, COLORS, STYLES


CATEGORY_MAP = {  # Fashion Product 데이터셋 라벨 → 우리의 카테고리
    "Topwear": "top",
    "Bottomwear": "bottom",
    "Innerwear": "top",
    "Dress": "dress",
    "Outerwear": "outer",
    "Shoes": "shoes",
    "Sandal": "shoes",
    "Flip Flops": "shoes",
    "Bags": "bag",
    "Belts": "acc",
    "Watches": "acc",
    "Eyewear": "acc",
    "Jewellery": "acc",
}

STYLE_MAP = {  # usage → style
    "Casual": "casual",
    "Formal": "formal",
    "Sports": "sporty",
    "Smart Casual": "casual",
    "Ethnic": "street",
    "Party": "minimal",
}

COLOR_MAP = {  # baseColour → color (없는 색은 가장 가까운 색으로)
    "White": "white", "Black": "black", "Grey": "gray", "Silver": "gray",
    "Beige": "beige", "Cream": "beige", "Khaki": "beige", "Tan": "beige",
    "Navy Blue": "navy", "Blue": "blue", "Turquoise Blue": "blue", "Teal": "blue",
    "Red": "red", "Maroon": "red", "Rust": "red", "Burgundy": "red",
    "Green": "green", "Olive": "green", "Sea Green": "green",
    "Yellow": "yellow", "Mustard": "yellow", "Gold": "yellow",
    "Pink": "pink", "Magenta": "pink", "Peach": "pink", "Lavender": "pink",
    "Brown": "brown", "Coffee Brown": "brown", "Mushroom Brown": "brown",
}


class FashionDataset(Dataset):
    def __init__(
        self,
        root: Path | str,
        split_csv: Optional[Path | str] = None,
        transform: Optional[Callable] = None,
    ) -> None:
        self.root = Path(root)
        self.transform = transform

        csv_path = Path(split_csv) if split_csv else self.root / "styles.csv"
        # styles.csv는 라인 수가 다를 수 있어 on_bad_lines='skip'
        df = pd.read_csv(csv_path, on_bad_lines="skip")

        df["category"] = df["subCategory"].map(CATEGORY_MAP)
        df["style_norm"] = df["usage"].map(STYLE_MAP).fillna("casual")
        df["color_norm"] = df["baseColour"].map(COLOR_MAP)

        df = df.dropna(subset=["category", "color_norm", "style_norm"])
        df["image_path"] = df["id"].apply(lambda i: self.root / "images" / f"{i}.jpg")
        df = df[df["image_path"].apply(lambda p: p.exists())]

        self.df = df.reset_index(drop=True)

    def __len__(self) -> int:
        return len(self.df)

    def __getitem__(self, idx: int):
        row = self.df.iloc[idx]
        img = Image.open(row["image_path"]).convert("RGB")
        if self.transform:
            img = self.transform(img)
        cat = CATEGORIES.index(row["category"])
        col = COLORS.index(row["color_norm"])
        sty = STYLES.index(row["style_norm"])
        return img, torch.tensor(cat), torch.tensor(col), torch.tensor(sty)
