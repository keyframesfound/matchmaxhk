/**
 * Notes upload v2: forgiving shop search.
 *
 * Buyers rarely type a listing's exact title, so the shop ranks by meaning
 * instead of substring:
 *  - Simplified Chinese is folded onto Traditional (one shared index for
 *    繁 / 简 input), full-width characters onto ASCII (NFKC).
 *  - Synonym groups join English, 繁體 and 简体 terms (IA = internal
 *    assessment = 內部評估, past paper = 歷屆試題, ...).
 *  - Latin words tolerate typos (edit distance 1, or 2 for long words).
 *  - Chinese runs match by character bigrams, so 歷屆試題筆記 still finds
 *    "DSE 歷屆試題 + 筆記".
 *  - Results are ranked; a listing matching most of the query concepts is
 *    kept even when one word misses (broad results, best first).
 *
 * Pure and dependency-free: runs in the browser over the already-loaded
 * shop list, and is unit-tested in tests/materials/note-search.test.ts.
 */

// ---------------------------------------------------------------------------
// Simplified -> Traditional folding (education vocabulary, not exhaustive)
// ---------------------------------------------------------------------------

const S2T_PAIRS =
  "试試 题題 历歷 届屆 评評 内內 数數 学學 经經 济濟 语語 笔筆 记記 练練 习習 论論 说說 认認 识識 读讀 写寫 听聽 汇匯 总總 计計 机機 设設 资資 讯訊 会會 业業 应應 价價 课課 级級 补補 导導 师師 际際 国國 华華 门門 们們 个個 这這 为為 与與 对對 时時 间間 问問 关關 开開 发發 动動 实實 验驗 现現 页頁 长長 简簡 单單 体體 质質 点點 线線 图圖 样樣 难難 范範 释釋 词詞 组組 织織 结結 构構 积積 极極 测測 选選 择擇 阅閱 综綜 专專 报報 优優 拟擬 详詳 温溫 备備 战戰 务務 财財 术術 艺藝 乐樂 视視 觉覺 环環 气氣 欧歐 亚亞 马馬 进進 阶階 础礎 运運 电電 脑腦 网網 络絡 册冊 证證 观觀 讲講 义義 闪閃 汉漢 获獲 卷卷 观觀 复複 杂雜 换換 变變 节節 类類 别別 区區 场場 产產 贸貿 银銀 币幣 积積 级級 际際 质質 粮糧 农農 厂廠 矿礦 铁鐵 钢鋼 气氣 热熱 光光 声聲 压壓 势勢 磁磁 场場 粒粒 纳納 钠鈉 镁鎂 铝鋁 氯氯 钾鉀 钙鈣 锌鋅 铜銅 银銀 碳碳 氢氫 氧氧 氮氮 酸酸 盐鹽 碱鹼 细細 胞胞 遗遺 传傳 进進 化化 态態 统統 卫衛 养養 病病 药藥 医醫 疗療 护護 脏臟 脉脈 头頭 脑腦 骨骨 肤膚 叶葉 绿綠 树樹 园園 鸟鳥 鱼魚 虫蟲 宁寧 宝寶 实實 宽寬 广廣 庆慶 庙廟 应應 怀懷 态態 惊驚 惯慣 战戰 戏戲 户戶 扩擴 扫掃 护護 报報 担擔 据據 掷擲 摄攝 摆擺 敌敵 无無 旧舊 显顯 晋晉 暂暫 术術 朴樸 杀殺 杂雜 权權 条條 来來 杨楊 极極 构構 标標 栏欄 树樹 样樣 档檔 桥橋 检檢 楼樓 欢歡 毕畢 汇匯 沟溝 没沒 泽澤 洁潔 浅淺 测測 济濟 浓濃 涂塗 涛濤 渊淵 温溫 湾灣 满滿 滞滯 灭滅 灯燈 灵靈 炼煉 烟煙 烦煩 爱愛 牵牽 犹猶 独獨 狮獅 献獻 环環 现現 琐瑣 电電 画畫 畅暢 疗療 皱皺 盖蓋 盘盤 着著 矫矯 码碼 础礎 确確 礼禮 祸禍 离離 种種 积積 称稱 稳穩 穷窮 竞競 笔筆 简簡 签簽 粤粵 紧緊 纪紀 约約 级級 纯純 纲綱 纵縱 纸紙 线線 练練 组組 细細 织織 终終 绍紹 经經 结結 绕繞 绘繪 给給 络絡 绝絕 统統 继繼 绩績 续續 维維 综綜 编編 缘緣 缩縮 网網 罗羅 职職 联聯 肃肅 胜勝 脱脫 艰艱 节節 苏蘇 范範 荣榮 药藥 获獲 营營 虑慮 补補 装裝 观觀 规規 视視 览覽 觉覺 誉譽 计計 订訂 认認 讨討 让讓 训訓 议議 记記 讲講 许許 论論 设設 访訪 证證 评評 识識 诉訴 词詞 译譯 试試 诗詩 诚誠 话話 询詢 该該 详詳 语語 误誤 说說 请請 诸諸 读讀 课課 谁誰 调調 谈談 谋謀 谓謂 谢謝 谱譜 贝貝 负負 贡貢 财財 责責 败敗 货貨 质質 购購 贯貫 贵貴 费費 贸貿 资資 赏賞 赛賽 赞贊 赶趕 跃躍 践踐 车車 轨軌 转轉 轮輪 软軟 轻輕 载載 较較 辅輔 辑輯 输輸 辞辭 边邊 达達 迁遷 过過 运運 还還 这這 进進 远遠 违違 连連 迟遲 适適 选選 递遞 逻邏 遗遺 邮郵 邻鄰 郑鄭 释釋 里裡 针針 钟鐘 钱錢 铁鐵 链鏈 销銷 锁鎖 错錯 键鍵 长長 门門 闭閉 问問 闲閒 间間 闻聞 阅閱 队隊 阳陽 阶階 际際 陆陸 陈陳 险險 随隨 隐隱 难難 预預 领領 频頻 题題 额額 风風 飞飛 饭飯 馆館 驱驅 验驗 骤驟 鲁魯 鸡雞 麦麥 黄黃 齐齊 龙龍";

const S2T: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const pair of S2T_PAIRS.split(/\s+/)) {
    const chars = Array.from(pair);
    if (chars.length === 2 && chars[0] !== chars[1]) map.set(chars[0], chars[1]);
  }
  return map;
})();

/** Fold Simplified characters onto Traditional (education vocabulary). */
export function foldSimplified(text: string): string {
  let out = "";
  for (const ch of text) out += S2T.get(ch) ?? ch;
  return out;
}

/** NFKC + lowercase + 简->繁 + collapse punctuation to spaces. */
export function normalizeSearchText(text: string): string {
  return foldSimplified(text.normalize("NFKC").toLowerCase())
    .replace(/[‐-―]/g, "-")
    .replace(/[^\p{L}\p{N}+#\s-]+/gu, " ")
    .replace(/(\p{L})-(\p{L})/gu, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Synonyms (written in Traditional; Simplified input is folded first)
// ---------------------------------------------------------------------------

export const SEARCH_SYNONYM_GROUPS: string[][] = [
  ["ia", "internal assessment", "內部評估", "內部評核", "內評", "個人研習"],
  ["ee", "extended essay", "專題論文", "延伸論文", "拓展論文"],
  ["tok", "theory of knowledge", "知識論"],
  ["past paper", "past papers", "pastpaper", "pp", "歷屆試題", "歷屆試卷", "歷屆", "試卷", "真題"],
  ["mock", "mock exam", "mock paper", "mock papers", "模擬試卷", "模擬考試", "模擬卷", "模擬"],
  ["notes", "note", "筆記", "revision notes", "溫習筆記", "summary", "重點", "總結"],
  ["sba", "school based assessment", "校本評核", "校本評估"],
  ["exemplar", "sample", "model answer", "model essay", "範文", "範例", "佳作", "示例"],
  ["flashcards", "flashcard", "anki", "閃卡", "記憶卡", "字卡"],
  ["formula", "formula sheet", "formulae", "公式", "公式表"],
  ["vocab", "vocabulary", "詞彙", "生字", "字詞"],
  ["essay", "作文", "寫作", "writing", "文章"],
  ["math", "maths", "mathematics", "數學", "數"],
  ["economics", "econ", "經濟"],
  ["biology", "bio", "生物"],
  ["chemistry", "chem", "化學"],
  ["physics", "phy", "phys", "物理"],
  ["chinese", "中文", "中國語文", "語文"],
  ["english", "eng", "英文", "英語"],
  ["chinese history", "chi hist", "中史", "中國歷史"],
  ["history", "hist", "歷史"],
  ["geography", "geog", "geo", "地理"],
  ["business", "business management", "bafs", "企會財", "商業", "會計"],
  ["computer science", "ict", "cs", "資訊及通訊科技", "電腦", "編程"],
  [
    "citizenship",
    "citizenship and social development",
    "公民與社會發展",
    "公社科",
    "通識",
    "liberal studies",
  ],
  ["paper 1", "paper1", "p1", "卷一", "試卷一"],
  ["paper 2", "paper2", "p2", "卷二", "試卷二"],
  ["paper 3", "paper3", "p3", "卷三", "試卷三"],
  ["paper 4", "paper4", "p4", "卷四"],
  ["dse", "hkdse", "文憑試", "中學文憑"],
  ["ib", "ibdp", "國際文憑", "ib diploma"],
  ["igcse", "gcse"],
  ["a level", "alevel", "a levels", "al", "高考"],
  ["answers", "answer", "solutions", "solution", "答案", "詳解", "題解"],
  ["question bank", "questions", "練習", "習題", "題目", "practice"],
  ["cheat sheet", "cheatsheet", "cheat", "速查表", "懶人包", "精華", "攻略"],
  ["guide", "handbook", "指南", "手冊", "教學", "tutorial"],
  ["trading", "trade", "day trade", "daytrade", "交易", "炒股", "日內交易"],
  ["investing", "investment", "invest", "投資", "理財"],
  ["stock", "stocks", "shares", "股票", "股市"],
  ["finance", "financial", "金融", "財務"],
  ["literature", "lit", "文學"],
  ["language", "lang", "語言"],
  ["grammar", "文法", "語法"],
  ["reading", "閱讀", "閱讀理解"],
  ["listening", "聆聽"],
  ["speaking", "oral", "說話", "口試"],
  ["psychology", "psych", "心理學"],
  ["visual arts", "art", "arts", "視覺藝術", "美術"],
  ["music", "音樂"],
  ["physical education", "pe", "體育"],
  ["science", "科學"],
  ["combined science", "綜合科學"],
  ["m1", "calculus and statistics", "微積分與統計"],
  ["m2", "algebra and calculus", "代數與微積分"],
];

const SYNONYM_LOOKUP: Map<string, number> = (() => {
  const map = new Map<string, number>();
  SEARCH_SYNONYM_GROUPS.forEach((group, index) => {
    for (const term of group) map.set(normalizeSearchText(term), index);
  });
  return map;
})();

/** Longest synonym phrase first, so "chinese history" beats "chinese". */
const SYNONYM_PHRASES: string[] = Array.from(SYNONYM_LOOKUP.keys()).sort(
  (a, b) => b.length - a.length,
);

// ---------------------------------------------------------------------------
// Tokenising
// ---------------------------------------------------------------------------

const CJK = /[㐀-鿿豈-﫿]/u;

function isCjk(text: string): boolean {
  return CJK.test(text);
}

/** Character bigrams of a CJK run (a single char yields itself). */
export function cjkBigrams(run: string): string[] {
  const chars = Array.from(run);
  if (chars.length <= 1) return chars;
  const out: string[] = [];
  for (let i = 0; i < chars.length - 1; i += 1) out.push(chars[i] + chars[i + 1]);
  return out;
}

/** A query concept: any of `alternatives` satisfies it. */
export type QueryConcept = {
  alternatives: string[];
  /** CJK run split into bigrams (partial credit), when no synonym matched. */
  bigrams?: string[];
  /** Latin word that may fuzzy-match. */
  fuzzy?: string;
};

function splitLatinAndCjk(segment: string): string[] {
  return segment.match(/[㐀-鿿豈-﫿]+|[^㐀-鿿豈-﫿]+/gu) ?? [];
}

/** Break a query into concepts: synonym phrases first, then words / CJK runs. */
export function parseQuery(rawQuery: string): QueryConcept[] {
  let rest = ` ${normalizeSearchText(rawQuery)} `;
  const concepts: QueryConcept[] = [];
  const seenGroups = new Set<number>();

  for (const phrase of SYNONYM_PHRASES) {
    if (!phrase) continue;
    const cjkPhrase = isCjk(phrase);
    // Latin phrases must sit on word boundaries ("ia" must not hit "media").
    const needle = cjkPhrase ? phrase : ` ${phrase} `;
    if (!rest.includes(needle)) continue;
    const group = SYNONYM_LOOKUP.get(phrase);
    if (group == null) continue;
    rest = rest.split(needle).join(" ");
    if (!cjkPhrase) rest = ` ${rest} `;
    if (seenGroups.has(group)) continue;
    seenGroups.add(group);
    concepts.push({
      alternatives: SEARCH_SYNONYM_GROUPS[group].map((t) => normalizeSearchText(t)),
    });
  }

  for (const word of rest.split(" ")) {
    if (!word) continue;
    for (const part of splitLatinAndCjk(word)) {
      const trimmed = part.replace(/^-+|-+$/g, "");
      if (!trimmed) continue;
      if (isCjk(trimmed)) {
        concepts.push({ alternatives: [trimmed], bigrams: cjkBigrams(trimmed) });
      } else {
        concepts.push({
          alternatives: [trimmed],
          fuzzy: trimmed.length >= 4 ? trimmed : undefined,
        });
      }
    }
  }
  return concepts;
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/** Damerau-free Levenshtein with an early exit above `max`. */
export function editDistance(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      curr.push(value);
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    prev = curr;
  }
  return prev[b.length];
}

export type SearchDocument = {
  /** Weighted heavier (title, summary, subject). */
  primary: string[];
  /** Everything else (description, tags, tutor, labels). */
  secondary: string[];
};

export type SearchIndex = {
  primary: string;
  secondary: string;
  words: string[];
};

export function buildSearchIndex(doc: SearchDocument): SearchIndex {
  const primary = ` ${normalizeSearchText(doc.primary.filter(Boolean).join(" \u0001 "))} `;
  const secondary = ` ${normalizeSearchText(doc.secondary.filter(Boolean).join(" \u0001 "))} `;
  const words = Array.from(
    new Set(`${primary} ${secondary}`.split(" ").filter((w) => w.length >= 3 && !isCjk(w))),
  );
  return { primary, secondary, words };
}

function containsTerm(haystack: string, term: string): boolean {
  if (isCjk(term)) return haystack.includes(term);
  // Latin: whole-word or word-prefix match (min 3 chars for prefixes).
  if (haystack.includes(` ${term} `)) return true;
  return term.length >= 3 && haystack.includes(` ${term}`);
}

function conceptScore(concept: QueryConcept, index: SearchIndex): number {
  let best = 0;
  for (const alt of concept.alternatives) {
    if (containsTerm(index.primary, alt)) return 3;
    if (containsTerm(index.secondary, alt)) best = Math.max(best, 1.5);
  }
  if (best > 0) return best;

  if (concept.bigrams && concept.bigrams.length > 1) {
    const hits = concept.bigrams.filter(
      (bg) => index.primary.includes(bg) || index.secondary.includes(bg),
    ).length;
    const ratio = hits / concept.bigrams.length;
    if (ratio >= 0.5) return 2 * ratio;
  }

  if (concept.fuzzy) {
    const max = concept.fuzzy.length >= 8 ? 2 : 1;
    for (const word of index.words) {
      if (editDistance(concept.fuzzy, word, max) <= max) return 0.9;
      // Typo inside a prefix ("physic" vs "physics" is a prefix hit above;
      // "phisics" vs "physics" lands here).
      if (word.length > concept.fuzzy.length + 2) {
        const head = word.slice(0, concept.fuzzy.length);
        if (editDistance(concept.fuzzy, head, max) <= max) return 0.7;
      }
    }
  }
  return 0;
}

/**
 * Score one listing for a parsed query. 0 = drop it. A listing must match
 * at least ceil(60%) of the concepts (all of them for 1-2 concept queries).
 */
export function scoreIndex(concepts: QueryConcept[], index: SearchIndex): number {
  if (concepts.length === 0) return 1;
  let total = 0;
  let matched = 0;
  for (const concept of concepts) {
    const s = conceptScore(concept, index);
    if (s > 0) matched += 1;
    total += s;
  }
  const needed = concepts.length <= 2 ? concepts.length : Math.ceil(concepts.length * 0.6);
  if (matched < needed) return 0;
  return total + matched * 0.5;
}

/** Rank `items` for `query`. Empty query keeps the original order. */
export function rankBySearch<T>(
  items: T[],
  query: string,
  toDocument: (item: T) => SearchDocument,
): T[] {
  const concepts = parseQuery(query);
  if (concepts.length === 0) return items;
  const scored: { item: T; score: number; order: number }[] = [];
  items.forEach((item, order) => {
    const score = scoreIndex(concepts, buildSearchIndex(toDocument(item)));
    if (score > 0) scored.push({ item, score, order });
  });
  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  return scored.map((s) => s.item);
}
