"""학습된 PyTorch 모델 → TFLite 변환.

사용 예시:
    python -m ml.src.convert_tflite \
        --backbone mobilenet_v3_small \
        --weights ml/outputs/mobilenet_v3_small_fashion.pth \
        --output ml/outputs/fashion_classifier.tflite

기획서 spec 6.5 는 PyTorch → ONNX → TFLite (onnx-tf) 였지만,
onnx-tf 가 최신 TF 와 호환되지 않아 실패하므로 (codex 가 사전에 지적한 리스크 항목),
Google 공식 직변환 도구인 litert-torch (ex ai-edge-torch) 로 PyTorch → TFLite 를 한 번에 한다.

이전 ONNX 산출물 (`fashion_classifier.onnx`) 도 검증용으로 함께 생성.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import torch

from .model import FashionClassifier


def export_onnx(weights: Path, backbone: str, onnx_path: Path) -> None:
    """PyTorch → ONNX. 모델 검증/디버깅용으로 보관."""
    model = FashionClassifier(backbone)
    model.load_state_dict(torch.load(weights, map_location="cpu"))
    model.eval()
    dummy = torch.randn(1, 3, 224, 224)
    torch.onnx.export(
        model,
        dummy,
        onnx_path.as_posix(),
        input_names=["input"],
        output_names=["category", "color", "style"],
        opset_version=18,
        do_constant_folding=True,
        dynamic_axes={"input": {0: "batch"}},
    )
    print(f"Saved ONNX → {onnx_path}")


def convert_to_tflite(weights: Path, backbone: str, tflite_path: Path) -> None:
    """PyTorch → TFLite 직변환 via litert-torch."""
    import litert_torch  # type: ignore

    model = FashionClassifier(backbone)
    model.load_state_dict(torch.load(weights, map_location="cpu"))
    model.eval()
    sample_input = (torch.randn(1, 3, 224, 224),)

    edge_model = litert_torch.convert(model, sample_input)
    edge_model.export(tflite_path.as_posix())

    size_mb = tflite_path.stat().st_size / 1024 / 1024
    print(f"Saved TFLite → {tflite_path} ({size_mb:.2f} MB)")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--backbone", required=True,
                        choices=["resnet50", "mobilenet_v3_small"])
    parser.add_argument("--weights", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path,
                        help="output .tflite path")
    parser.add_argument("--skip-onnx", action="store_true",
                        help="ONNX 중간 산출물 생성 건너뛰기")
    args = parser.parse_args()

    args.output.parent.mkdir(parents=True, exist_ok=True)

    if not args.skip_onnx:
        onnx_path = args.output.with_suffix(".onnx")
        export_onnx(args.weights, args.backbone, onnx_path)

    convert_to_tflite(args.weights, args.backbone, args.output)


if __name__ == "__main__":
    main()
