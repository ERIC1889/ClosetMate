"""두 백본의 CPU 추론 속도 비교 — 모바일 환경에 가까운 측정.

MPS 가속이 아닌 CPU 로 측정해서, 실제 모바일 디바이스 추론 시간의 대용으로 사용한다.
(MPS / iPhone Neural Engine 절대 시간은 다르지만 두 모델의 상대 비율은 의미가 있다.)
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import torch

from .model import FashionClassifier


def benchmark(backbone: str, weights: Path, warmup: int, runs: int) -> dict:
    device = torch.device("cpu")
    model = FashionClassifier(backbone)
    model.load_state_dict(torch.load(weights, map_location=device))
    model.eval().to(device)

    x = torch.randn(1, 3, 224, 224, device=device)

    # warm-up
    with torch.no_grad():
        for _ in range(warmup):
            model(x)

    # 측정
    times = []
    with torch.no_grad():
        for _ in range(runs):
            t0 = time.perf_counter()
            model(x)
            times.append(time.perf_counter() - t0)

    times.sort()
    n = len(times)
    return {
        "backbone": backbone,
        "weights_path": weights.as_posix(),
        "weights_mb": weights.stat().st_size / 1024 / 1024,
        "device": "cpu",
        "warmup": warmup,
        "runs": runs,
        "mean_ms": sum(times) / n * 1000,
        "median_ms": times[n // 2] * 1000,
        "p90_ms": times[int(n * 0.9)] * 1000,
        "min_ms": times[0] * 1000,
        "max_ms": times[-1] * 1000,
        "params_total": sum(p.numel() for p in model.parameters()),
        "params_trainable": sum(p.numel() for p in model.parameters() if p.requires_grad),
    }


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--warmup", type=int, default=5)
    p.add_argument("--runs", type=int, default=30)
    p.add_argument("--output", default="ml/outputs/benchmark.json")
    args = p.parse_args()

    results = []
    for bb, wpath in [
        ("mobilenet_v3_small", Path("ml/outputs/mobilenet_v3_small_fashion.pth")),
        ("resnet50", Path("ml/outputs/resnet50_fashion.pth")),
    ]:
        print(f"benchmarking {bb} ...")
        r = benchmark(bb, wpath, args.warmup, args.runs)
        print(
            f"  mean {r['mean_ms']:.2f}ms (median {r['median_ms']:.2f}, p90 {r['p90_ms']:.2f}, "
            f"min {r['min_ms']:.2f}, max {r['max_ms']:.2f})"
        )
        results.append(r)

    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(json.dumps(results, indent=2))
    print(f"Saved → {args.output}")


if __name__ == "__main__":
    main()
