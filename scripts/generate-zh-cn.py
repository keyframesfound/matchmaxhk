#!/usr/bin/env python3
"""Generate src/features/i18n/locales/zh-CN.json from zh-HK.json.

Simplified Chinese UI (owner-approved 2026-11-01) is derived from the
Traditional (Hong Kong) copy, so zh-CN never drifts from zh-HK. Re-run after
changing zh-HK.json:

    pip install opencc-python-reimplemented
    python3 scripts/generate-zh-cn.py      # or: npm run gen:zh-cn

A plain OpenCC hk2s pass only converts characters, so Cantonese *grammar*
(嘅 唔 咗 喺 呢 啲 哋 嚟 睇 俾) survives into what is supposed to be Mandarin.
The pipeline below is therefore ordered in stages:

    1. OpenCC hk2s character conversion + VOCAB translations.
    2. PRE_PHRASES  - resolve 同 ambiguities before masking.
    3. MASKS        - protect words whose characters must NOT be rewritten
                      (系 compounds like 系统/关系, 同 compounds like 同意/同学).
    4. PHRASES      - longest-first Cantonese word/particle rewrites.
    5. CHARS        - single-character rewrites (particles, 系 to 是, 同 to 和).
    6. unmask, then OVERRIDES.

Masks exist because hk2s merges 係 into 系 and leaves 同 alone: without them
系统 would become 是统, 关系 would become 关是, and 同意 would become 和意.

npm run check:i18n fails on key parity if zh-CN.json is stale.
"""

import json
from pathlib import Path

import opencc

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src/features/i18n/locales/zh-HK.json"
OUT = ROOT / "src/features/i18n/locales/zh-CN.json"

# Dotted key -> Simplified value, for places the pipeline reads wrong.
OVERRIDES: dict[str, str] = {
    # "same subject / same curriculum" labels. 同 here is Mandarin "same",
    # not the Cantonese conjunction, so it must not become 和.
    "notes.price_guide.tier_subject": "同科目",
    "notes.price_guide.tier_subcategory": "同科目及分类",
    "notes.price_guide.tier_curriculum": "同课程",
    "rail.similar_tutors.badge_subject": "同科",
    "rail.similar_tutors.badge_strict": "同科及同课程",
    "rail.similar_tutors.badge_value": "同科 · 弹性学费／在线授课",
    # Cantonese 量词 / 判断句 shapes that a word-level swap cannot fix.
    "account.claim.confirm": "这张是我的卡",
    "guide.partners.rules_title": "MatchMax 是什么——不是什么",
    # 同日 mask keeps 同 alive here, but the sentence needs 同一天.
    "case_manager.series_hint": "按香港时间，每周同一天及时间填入课堂，并即时显示在双方的日历。",
}

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
    # Extra vocabulary found in the HK copy.
    ("字元", "字符"),
    ("钟费", "课时费"),
    ("细楷", "小写"),
    ("底线", "下划线"),
]

# --- stage 2: 同 disambiguators ------------------------------------------
# 同 is both the Cantonese conjunction ("and", -> 和) and the Mandarin "same".
# These two collocations look like the masked word 同学 but mean "and ...",
# so they are rewritten before masking.
PRE_PHRASES = [
    ("同学生", "和学生"),
    ("同学历", "和学历"),
    # 同 + 时间/学习 would otherwise be swallowed by the 同时 / 同学 masks.
    ("同时间", "和时间"),
    ("同学习", "以及学习"),
]

# --- stage 3: masks -----------------------------------------------------
# 係 was already merged into 系 by hk2s, so 系 must not be flattened to 是
# inside these words. Anything not listed here is the copula -> 是.
XI_MASKS = [
    "系统",
    "体系",
    "关系",
    "联系",
    "连系",
    "系列",
    "谱系",
    "维系",
    "星系",
    "派系",
    "系数",
    "系谱",
    "系别",
]

# 同 is masked only where it is Mandarin "same" or a fixed compound. 同科 is
# deliberately NOT masked: in prose it is the conjunction (时间表同科目 ->
# 时间表和科目), and the few "same subject" labels are fixed by OVERRIDES.
TONG_MASKS = [
    "同意",
    "同时",
    "同一",
    "相同",
    "认同",
    "共同",
    "同样",
    "同日",
    "同等",
    "同步",
    "连同",
    "合同",
    "同学",
    "同事",
    "同盟",
    "同行",
    "同龄",
    "同班",
    "同校",
    "同款",
    "同级",
    "同区",
    "同性",
]

# Words produced by PHRASES that still contain a character CHARS rewrites.
POST_MASKS = [
    "不同",
]

# --- stage 4: phrases (sorted longest-first at import time) --------------
# 唔同 MUST precede 唔, 成个月 MUST precede 成个, 系咪 MUST precede 系,
# and every phrase MUST precede the single-character stage.
PHRASES = [
    # Cantonese particles / grammar
    ("话畀礼宾团队知", "告诉礼宾团队"),
    ("话畀专人知", "告诉专人"),
    ("话俾我哋知", "告诉我们"),
    ("话返我哋知", "告诉我们"),
    ("话畀", "告诉"),
    ("混埋一齐", "混在一起"),
    ("就啱渠道", "就找对了渠道"),
    ("揿就得", "按就行"),
    ("开唔到", "打不开"),
    ("咗啲", "了一些"),
    ("攞返", "拿回"),
    ("睇埋", "查看"),
    ("睇晒", "查看"),
    ("成个月", "整月"),
    ("成个", "整个"),
    ("点解", "为什么"),
    ("点运作", "怎样运作"),
    ("几多", "多少"),
    ("仲系", "还是"),
    ("仲未", "还没"),
    ("仲有", "还有"),
    ("仲可以", "还可以"),
    ("今堂", "这堂课"),
    ("唔同", "不同"),
    ("唔使", "不用"),
    ("唔好", "不要"),
    ("唔啱", "不合适"),
    ("冇问题", "没问题"),
    ("同埋", "和"),
    ("定系", "还是"),
    ("系咪", "是不是"),
    ("点样", "怎样"),
    ("点呀", "怎么样"),
    ("点计", "怎么算"),
    ("做得点", "做得怎么样"),
    ("而家", "现在"),
    ("净低", "剩下"),
    ("拣选", "挑选"),
    ("带埋", "附带"),
    ("话事", "决定"),
    ("心水", "心仪"),
    ("啱你", "符合你"),
    ("最啱", "最适合"),
    ("找啱", "找对"),
    # Cantonese syntax: 先... = "only then ..."
    ("先会", "才会"),
    ("先可以", "才能"),
    ("先至", "再"),
    # Cantonese verbs / nouns / adverbs
    ("搞唔掂", "搞不定"),
    ("搞掂", "搞定"),
    ("凑仔", "带孩子"),
    ("仔女", "子女"),
    ("格仔", "格子"),
    ("少少", "一点"),
    ("识得", "认识"),
    ("钟意", "喜欢"),
    ("一齐", "一起"),
    ("返嚟", "回来"),
    ("返主页", "回主页"),
    ("找返", "找回"),
    ("拣返", "选回"),
    ("喺度", "正在"),
    ("自己定帮", "自己还是帮"),
    ("描述吓个", "描述一下这个"),
    ("参考吓", "参考一下"),
    ("点核实", "怎样核实"),
    ("点算", "怎么办"),
    ("点上堂", "怎样上课"),
    ("点叫", "怎么叫"),
    ("一次过", "一次性"),
    ("正正系", "正是"),
    ("呢个客", "这位客户"),
    ("乜嘢", "什么"),
    ("啲乜", "什么"),
    ("嘅嘢", "的东西"),
    ("样嘢", "东西"),
    ("咁样", "这样"),
    ("话俾", "告诉"),
    ("话返", "告诉"),
    ("呢度", "这里"),
    ("𠮶度", "那里"),
    ("𠮶阵", "那时"),
    # 边 -> 哪 is phrase-only: 那边 / 身边 / 周边 must keep 边.
    ("边一级", "哪一级"),
    ("边个", "哪个"),
    ("边位", "哪位"),
    ("边度", "哪里"),
    ("边类", "哪类"),
    ("边啲", "哪些"),
    ("边种", "哪种"),
]

# Longest first: a longer entry can never be shadowed by a shorter one, and
# every multi-character entry runs before the single-character stage.
PHRASES = sorted(PHRASES, key=lambda pair: -len(pair[0]))

# --- stage 5: single characters -----------------------------------------
# Order only matters where a replacement could feed the next rule, which it
# does not here (咁样 / 系咪 / 唔同 / 呢度 were all consumed above).
CHARS = [
    ("嘅", "的"),
    ("唔", "不"),
    ("咗", "了"),
    ("喺", "在"),
    ("呢", "这"),
    ("啲", "些"),
    ("哋", "们"),
    ("嚟", "来"),
    ("睇", "看"),
    ("俾", "给"),
    ("畀", "给"),
    ("揾", "找"),
    ("咩", "什么"),
    ("冇", "没有"),
    ("佢", "他"),
    ("系", "是"),
    ("同", "和"),
    ("嘢", "东西"),
    ("乜", "什么"),
    ("咁", "这么"),
    ("揿", "按"),
    ("㩒", "按"),
    ("拣", "选"),
    ("攞", "拿"),
    ("啱", "对"),
    ("𠮶", "那"),
    ("嗰", "那"),
]

# #824 §2.1: Mainland marketing wording (補習 -> 家教). Applied after VOCAB,
# longest first. Compound nouns are guarded first so a tutoring centre never
# becomes a "家教社": 補習社 keeps its name and 補習中心 reads 培训机构.
# Placeholders keep the guarded words out of the generic swap.
MARKETING_GUARDS = [
    ("补习中心", "培训机构"),
    ("补习社", "\0GUARD_SHE\0"),
]
MARKETING_VOCAB = [
    ("补习", "家教"),
]
MARKETING_RESTORE = [("\0GUARD_SHE\0", "补习社")]

# Legal / ToS / cookie text is #783's source of truth: no marketing swaps.
LEGAL_NAMESPACES = {"legal", "terms", "tos", "cookie_consent"}

converter = opencc.OpenCC("hk2s")

_MASK_BASE = 0xE000
_MASK_TAIL = 0xE100


def _mask(
    text: str, groups: list[list[str]], start: int = 0
) -> tuple[str, list[tuple[str, str]], int]:
    """Swap protected words for private-use placeholders, longest first.

    Returns the text, the (token, word) pairs, and the next free placeholder
    index so a second pass cannot hand out a token that is already in use.
    """
    placeholders: list[tuple[str, str]] = []
    index = start
    for group in groups:
        for word in sorted(group, key=len, reverse=True):
            if word in text:
                token = chr(_MASK_BASE + index) + chr(_MASK_TAIL + index)
                placeholders.append((token, word))
                text = text.replace(word, token)
                index += 1
    return text, placeholders, index


def to_simplified(text: str, marketing: bool = True) -> str:
    out = converter.convert(text)
    for old, new in VOCAB:
        out = out.replace(old, new)
    for old, new in PRE_PHRASES:
        out = out.replace(old, new)

    out, placeholders, used = _mask(out, [XI_MASKS, TONG_MASKS])

    for old, new in PHRASES:
        out = out.replace(old, new)

    # A phrase may emit a word that the single-character stage would then
    # break: 唔同 -> 不同 must not become 不 + 同 -> 和. Mask those again.
    out, later, _ = _mask(out, [POST_MASKS], start=used)
    placeholders += later

    for old, new in CHARS:
        out = out.replace(old, new)

    for token, word in placeholders:
        out = out.replace(token, word)

    # #824 §2.1 marketing wording (補習 -> 家教) runs LAST, so a grammar swap
    # below cannot undo it, and is skipped for legal namespaces (see
    # convert_root). Compound guards keep 補習社 a name, 補習中心 a 培训机构.
    if marketing:
        for table in (MARKETING_GUARDS, MARKETING_VOCAB, MARKETING_RESTORE):
            for old, new in table:
                out = out.replace(old, new)
    return out


def convert(value, marketing: bool = True):
    if isinstance(value, str):
        return to_simplified(value, marketing)
    if isinstance(value, dict):
        return {key: convert(child, marketing) for key, child in value.items()}
    if isinstance(value, list):
        return [convert(child, marketing) for child in value]
    return value


def convert_root(tree):
    return {
        key: convert(child, marketing=key not in LEGAL_NAMESPACES)
        for key, child in tree.items()
    }


def apply_overrides(tree):
    for dotted, text in OVERRIDES.items():
        node = tree
        *parents, leaf = dotted.split(".")
        for part in parents:
            node = node[part]
        node[leaf] = text


data = convert_root(json.loads(SRC.read_text(encoding="utf8")))
apply_overrides(data)
OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
print(f"wrote {OUT.relative_to(ROOT)}")
