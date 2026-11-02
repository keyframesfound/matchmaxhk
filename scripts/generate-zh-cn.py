#!/usr/bin/env python3
"""Generate src/features/i18n/locales/zh-CN.json from zh-HK.json.

Simplified Chinese UI (owner-approved 2026-11-01) is a character-level
conversion of the Traditional (Hong Kong) copy with OpenCC's hk2s profile,
so zh-CN never drifts from zh-HK. Re-run after changing zh-HK.json:

    pip install opencc-python-reimplemented
    python3 scripts/generate-zh-cn.py

`npm run check:i18n` fails on key parity if zh-CN.json is stale.
Keys in OVERRIDES replace the converted value (mainland wording fixes).
"""

import json
from pathlib import Path

import opencc

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src/features/i18n/locales/zh-HK.json"
OUT = ROOT / "src/features/i18n/locales/zh-CN.json"

# Dotted key -> Simplified value, for places a character swap reads wrong.
OVERRIDES: dict[str, str] = {}

# Hong Kong -> mainland vocabulary, applied after the character swap
# (longest first). Keep this list conservative: only unambiguous swaps.
VOCAB = [
    ("储存空间", "存储空间"),
    ("上载", "上传"),
    ("连结", "链接"),
    ("帐户", "账户"),
    ("帐号", "账号"),
    ("揾", "找"),
    ("相片", "照片"),
    ("影片", "视频"),
    ("登入", "登录"),
    ("登出", "退出登录"),
    ("预设", "默认"),
    ("讯息", "消息"),
    ("储存", "保存"),
    ("网上", "在线"),
    ("支援", "支持"),
    ("介面", "界面"),
    ("电邮", "电子邮件"),
]

converter = opencc.OpenCC("hk2s")


def to_simplified(text: str) -> str:
    out = converter.convert(text)
    for old, new in VOCAB:
        out = out.replace(old, new)
    return out


def convert(value):
    if isinstance(value, str):
        return to_simplified(value)
    if isinstance(value, dict):
        return {key: convert(child) for key, child in value.items()}
    if isinstance(value, list):
        return [convert(child) for child in value]
    return value


def apply_overrides(tree):
    for dotted, text in OVERRIDES.items():
        node = tree
        *parents, leaf = dotted.split(".")
        for part in parents:
            node = node[part]
        node[leaf] = text


data = convert(json.loads(SRC.read_text(encoding="utf8")))
apply_overrides(data)
OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
print(f"wrote {OUT.relative_to(ROOT)}")
