"""ResNet50 / MobileNetV3-Small 공통 multi-task 분류기."""

from __future__ import annotations

from typing import Tuple

import torch
import torch.nn as nn
from torchvision import models

from .labels import NUM_CATEGORIES, NUM_COLORS, NUM_STYLES


def build_backbone(name: str) -> Tuple[nn.Module, int]:
    """ImageNet pretrained backbone을 만들고 (model, feature_dim) 반환."""
    name = name.lower()
    if name == "resnet50":
        m = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V2)
        in_features = m.fc.in_features
        m.fc = nn.Identity()
    elif name in {"mobilenet_v3_small", "mobilenetv3", "mobilenet"}:
        m = models.mobilenet_v3_small(weights=models.MobileNet_V3_Small_Weights.IMAGENET1K_V1)
        in_features = m.classifier[-1].in_features
        m.classifier[-1] = nn.Identity()
    else:
        raise ValueError(f"Unknown backbone: {name}")

    for p in m.parameters():
        p.requires_grad = False
    return m, in_features


class FashionClassifier(nn.Module):
    def __init__(self, backbone_name: str) -> None:
        super().__init__()
        self.backbone_name = backbone_name
        self.backbone, in_features = build_backbone(backbone_name)
        self.category_head = nn.Linear(in_features, NUM_CATEGORIES)
        self.color_head = nn.Linear(in_features, NUM_COLORS)
        self.style_head = nn.Linear(in_features, NUM_STYLES)

    def forward(self, x: torch.Tensor):
        feat = self.backbone(x)
        return (
            self.category_head(feat),
            self.color_head(feat),
            self.style_head(feat),
        )

    def trainable_parameters(self):
        return [p for p in self.parameters() if p.requires_grad]
