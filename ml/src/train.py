"""Multi-task 분류기 학습 스크립트.

사용 예시:
    python -m ml.src.train --backbone mobilenet_v3_small --epochs 10 --batch-size 32

산출물:
    ml/outputs/<backbone>_fashion.pth
    ml/outputs/<backbone>_metrics.json
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, random_split
from torchvision import transforms
from tqdm import tqdm

from .dataset import FashionDataset
from .model import FashionClassifier


def build_transforms():
    train_t = transforms.Compose(
        [
            transforms.Resize((256, 256)),
            transforms.RandomCrop(224),
            transforms.RandomHorizontalFlip(),
            transforms.ColorJitter(0.2, 0.2, 0.2),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ]
    )
    eval_t = transforms.Compose(
        [
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ]
    )
    return train_t, eval_t


def evaluate(model: nn.Module, loader: DataLoader, device: torch.device):
    model.eval()
    correct = {"category": 0, "color": 0, "style": 0}
    total = 0
    with torch.no_grad():
        for imgs, cat, col, sty in loader:
            imgs = imgs.to(device)
            p_cat, p_col, p_sty = model(imgs)
            correct["category"] += (p_cat.argmax(1).cpu() == cat).sum().item()
            correct["color"] += (p_col.argmax(1).cpu() == col).sum().item()
            correct["style"] += (p_sty.argmax(1).cpu() == sty).sum().item()
            total += imgs.size(0)
    return {k: v / total for k, v in correct.items()}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-root", default="ml/data/raw")
    parser.add_argument("--output-dir", default="ml/outputs")
    parser.add_argument("--backbone", default="mobilenet_v3_small",
                        choices=["resnet50", "mobilenet_v3_small"])
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--val-split", type=float, default=0.2)
    parser.add_argument("--num-workers", type=int, default=2)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    torch.manual_seed(args.seed)
    device = torch.device(
        "cuda" if torch.cuda.is_available() else
        "mps" if torch.backends.mps.is_available() else
        "cpu"
    )
    print(f"Device: {device}, Backbone: {args.backbone}")

    train_t, eval_t = build_transforms()
    full = FashionDataset(args.data_root, transform=train_t)
    print(f"Dataset size: {len(full)}")

    val_size = int(len(full) * args.val_split)
    train_size = len(full) - val_size
    train_ds, val_ds = random_split(
        full, [train_size, val_size], generator=torch.Generator().manual_seed(args.seed)
    )

    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True,
                              num_workers=args.num_workers, pin_memory=True)
    val_loader = DataLoader(val_ds, batch_size=args.batch_size, shuffle=False,
                            num_workers=args.num_workers, pin_memory=True)

    model = FashionClassifier(args.backbone).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.trainable_parameters(), lr=args.lr)

    history = []
    for epoch in range(1, args.epochs + 1):
        model.train()
        epoch_start = time.time()
        running = 0.0
        for imgs, cat, col, sty in tqdm(train_loader, desc=f"epoch {epoch}"):
            imgs = imgs.to(device)
            cat = cat.to(device)
            col = col.to(device)
            sty = sty.to(device)

            p_cat, p_col, p_sty = model(imgs)
            loss = (
                criterion(p_cat, cat)
                + criterion(p_col, col)
                + criterion(p_sty, sty)
            )
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            running += loss.item() * imgs.size(0)

        train_loss = running / len(train_ds)
        val_acc = evaluate(model, val_loader, device)
        epoch_time = time.time() - epoch_start
        record = {
            "epoch": epoch,
            "train_loss": train_loss,
            "val_acc": val_acc,
            "time_sec": epoch_time,
        }
        history.append(record)
        print(record)

    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    weights_path = out_dir / f"{args.backbone}_fashion.pth"
    torch.save(model.state_dict(), weights_path)
    print(f"Saved weights → {weights_path}")

    metrics_path = out_dir / f"{args.backbone}_metrics.json"
    metrics_path.write_text(json.dumps({
        "backbone": args.backbone,
        "epochs": args.epochs,
        "batch_size": args.batch_size,
        "lr": args.lr,
        "device": str(device),
        "history": history,
    }, indent=2, ensure_ascii=False))
    print(f"Saved metrics → {metrics_path}")


if __name__ == "__main__":
    main()
