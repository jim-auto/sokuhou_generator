"use strict";

const LEGACY_STORAGE_KEYS = [
  "sokuhou-generator-state-v2",
  "sokuhou-generator-state-v1",
];
const STORAGE_KEY = "sokuhou-generator-state-v3";
const MAX_REPORT_CHARS = 140;

const FIELD_KEYS = [
  "area",
  "datetime",
  "opponent",
  "age",
  "occupation",
  "streetValue",
  "cup",
  "specValue",
  "jojo",
  "open",
  "early",
  "middle",
  "result",
  "good",
  "reflection",
  "next",
  "memo",
];

const CONTROL_KEYS = [
  "seed",
  "includeProfile",
  "bulkMemo",
];

const DEFAULT_STATE = {
  tone: "tweet",
  length: "short",
  inputMode: "manual",
  seed: "",
  includeProfile: true,
  bulkMemo: "",
};

const TONE_CONFIG = {
  formal: {
    intro(ctx) {
      return [
        ctx.opponent ? `相手の系統は${ctx.opponent}。` : "",
        "対応内容を以下に整理します。",
      ].join("");
    },
    open(value) {
      return `オープンは${toSentence(value)}`;
    },
    early(value) {
      return `序盤反応は${toSentence(value)}`;
    },
    middle(value) {
      return `中盤反応は${toSentence(value)}`;
    },
    result(value) {
      return `結果は${toSentence(value)}`;
    },
    good(value) {
      return `良かった点は${toSentence(value)}`;
    },
    reflection(value) {
      return `反省点は${toSentence(value)}`;
    },
    next(value) {
      return `次回は${toSentence(value)}`;
    },
    closing(ctx) {
      return ctx.next
        ? `次回改善として、${toSentence(ctx.next)}`
        : "次回は反応の変化を見ながら、再現性のある動きを増やします。";
    },
  },
  casual: {
    intro(ctx) {
      return [
        ctx.opponent ? `相手は${ctx.opponent}。` : "",
        "全体の流れをざっくり共有します。",
      ].join("");
    },
    open(value) {
      return `入りは${toSentence(value)}`;
    },
    early(value) {
      return `序盤は${toSentence(value)}`;
    },
    middle(value) {
      return `中盤は${toSentence(value)}`;
    },
    result(value) {
      return `結果は${toSentence(value)}`;
    },
    good(value) {
      return `良かったのは${toSentence(value)}`;
    },
    reflection(value) {
      return `気になった点は${toSentence(value)}`;
    },
    next(value) {
      return `次は${toSentence(value)}`;
    },
    closing(ctx) {
      return ctx.next
        ? `次は${toSentence(ctx.next)}`
        : "次は序盤の温度感を見ながら、もう少し自然に広げます。";
    },
  },
  reflective: {
    intro(ctx) {
      return [
        ctx.opponent ? `相手の系統は${ctx.opponent}。` : "",
        "結果だけでなく、判断と改善点を中心に整理します。",
      ].join("");
    },
    open(value) {
      return `オープンでは${toSentence(value)}`;
    },
    early(value) {
      return `序盤反応は${toSentence(value)}`;
    },
    middle(value) {
      return `中盤反応は${toSentence(value)}`;
    },
    result(value) {
      return `結果は${toSentence(value)}`;
    },
    good(value) {
      return `良かった点としては${toSentence(value)}`;
    },
    reflection(value) {
      return `反省点としては${toSentence(value)}`;
    },
    next(value) {
      return `次回改善は${toSentence(value)}`;
    },
    closing(ctx) {
      const reflection = ctx.reflection
        ? `今回の反省は、${toSentence(ctx.reflection)}`
        : "今回の反省は、反応の変化をもう少し早く拾うことです。";
      const next = ctx.next
        ? `次回は${toSentence(ctx.next)}`
        : "次回は入り方と話題展開を絞って検証します。";
      return `${reflection}\n${next}`;
    },
  },
};

const REPORT_BUILDERS = {
  short: buildShortReport,
  standard: buildStandardReport,
  detailed: buildDetailedReport,
};

const TWEET_BUILDERS = {
  short: buildTweetShortReport,
  standard: buildTweetStandardReport,
  detailed: buildTweetDetailedReport,
};

const form = document.querySelector("#reportForm");
const outputText = document.querySelector("#outputText");
const copyButton = document.querySelector("#copyButton");
const sampleButton = document.querySelector("#sampleButton");
const clearButton = document.querySelector("#clearButton");
const randomSeedButton = document.querySelector("#randomSeedButton");
const manualFields = document.querySelector("#manualFields");
const bulkPanel = document.querySelector("#bulkPanel");
const toast = document.querySelector("#toast");
const saveStatus = document.querySelector("#saveStatus");

let toastTimer = 0;
let saveStatusTimer = 0;

init();

function init() {
  applyState(ensureSeed(loadState()));
  updateInputMode();
  renderAndSave(false);

  form.addEventListener("input", () => renderAndSave(true));
  form.addEventListener("change", () => renderAndSave(true));
  copyButton.addEventListener("click", copyReport);
  sampleButton.addEventListener("click", fillSample);
  clearButton.addEventListener("click", clearInputs);
  randomSeedButton.addEventListener("click", randomizeSeed);
}

function collectState() {
  const state = { ...DEFAULT_STATE };

  for (const key of FIELD_KEYS) {
    const field = document.querySelector(`[data-field="${key}"]`);
    state[key] = field ? field.value : "";
  }

  for (const key of CONTROL_KEYS) {
    const field = document.querySelector(`[data-control="${key}"]`);
    if (!field) {
      state[key] = "";
    } else if (field.type === "checkbox") {
      state[key] = field.checked;
    } else {
      state[key] = field.value.trim();
    }
  }

  const formData = new FormData(form);
  state.tone = formData.get("tone") || DEFAULT_STATE.tone;
  state.length = formData.get("length") || DEFAULT_STATE.length;
  state.inputMode = formData.get("inputMode") || DEFAULT_STATE.inputMode;

  return state;
}

function applyState(state) {
  const nextState = { ...DEFAULT_STATE, ...state };

  for (const key of FIELD_KEYS) {
    const field = document.querySelector(`[data-field="${key}"]`);
    if (field) {
      field.value = nextState[key] || "";
    }
  }

  for (const key of CONTROL_KEYS) {
    const field = document.querySelector(`[data-control="${key}"]`);
    if (field) {
      if (field.type === "checkbox") {
        field.checked = nextState[key] !== false && nextState[key] !== "false";
      } else {
        field.value = nextState[key] || "";
      }
    }
  }

  setRadioValue("tone", nextState.tone);
  setRadioValue("length", nextState.length);
  setRadioValue("inputMode", nextState.inputMode);
}

function setRadioValue(name, value) {
  const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
  const fallback = document.querySelector(`input[name="${name}"][value="${DEFAULT_STATE[name]}"]`);
  (radio || fallback).checked = true;
}

function renderAndSave(shouldSave) {
  updateInputMode();
  const state = collectState();
  outputText.textContent = generateReport(state);

  if (shouldSave) {
    saveState(state);
  }
}

function updateInputMode() {
  const mode = new FormData(form).get("inputMode") || DEFAULT_STATE.inputMode;
  if (bulkPanel) {
    bulkPanel.hidden = mode !== "bulk";
  }
  if (manualFields) {
    manualFields.hidden = mode === "bulk";
  }
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }

    for (const key of LEGACY_STORAGE_KEYS) {
      const legacySaved = localStorage.getItem(key);
      if (legacySaved) {
        return {
          ...JSON.parse(legacySaved),
          tone: DEFAULT_STATE.tone,
          length: DEFAULT_STATE.length,
          inputMode: DEFAULT_STATE.inputMode,
          seed: createRandomSeed(),
          includeProfile: DEFAULT_STATE.includeProfile,
        };
      }
    }

    return ensureSeed(DEFAULT_STATE);
  } catch {
    return ensureSeed(DEFAULT_STATE);
  }
}

function ensureSeed(state) {
  return {
    ...DEFAULT_STATE,
    ...state,
    seed: state.seed || createRandomSeed(),
  };
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    updateSaveStatus("保存済み");
  } catch {
    updateSaveStatus("保存不可");
  }
}

function updateSaveStatus(message) {
  saveStatus.textContent = message;
  window.clearTimeout(saveStatusTimer);
  saveStatusTimer = window.setTimeout(() => {
    saveStatus.textContent = "自動保存";
  }, 1400);
}

function generateReport(rawState) {
  const ctx = normalizeState(rawState);

  if (!hasReportInput(ctx)) {
    return "【即報】\nフォームに入力すると、ここに投稿用の即報文がリアルタイム表示されます。";
  }

  if (ctx.tone === "tweet") {
    return limitReport(buildTweetReport(ctx));
  }

  const builder = REPORT_BUILDERS[ctx.length] || REPORT_BUILDERS.standard;
  return limitReport(builder(ctx));
}

function normalizeState(state) {
  const normalized = {
    tone: state.tone || DEFAULT_STATE.tone,
    length: state.length || DEFAULT_STATE.length,
    inputMode: state.inputMode || DEFAULT_STATE.inputMode,
    seed: state.seed || "default",
    includeProfile: state.includeProfile !== false && state.includeProfile !== "false",
    bulkMemo: String(state.bulkMemo || "").trim(),
  };

  for (const key of FIELD_KEYS) {
    normalized[key] = cleanMultiline(state[key]);
  }

  if (normalized.inputMode === "bulk" && normalized.bulkMemo) {
    const parsed = parseBulkMemo(normalized.bulkMemo);
    for (const key of FIELD_KEYS) {
      normalized[key] = cleanMultiline(parsed[key] || normalized[key]);
    }
    if (!normalized.memo) {
      normalized.memo = cleanMultiline(normalized.bulkMemo);
    }
  }

  normalized.displayDate = formatDateTime(normalized.datetime);
  normalized.toneConfig = TONE_CONFIG[normalized.tone] || TONE_CONFIG.formal;

  return normalized;
}

function buildShortReport(ctx) {
  const tone = ctx.toneConfig;
  return joinBlocks([
    buildHeadline(ctx),
    profileLine(ctx, 48),
    tone.intro(ctx),
    section("要点", [
      bullet("オープン", ctx.open),
      bullet("序盤", ctx.early),
      bullet("中盤", ctx.middle),
      bullet("結果", ctx.result),
    ]),
    joinLines([
      ctx.good ? tone.good(ctx.good) : "",
      ctx.reflection ? tone.reflection(ctx.reflection) : "",
      tone.closing(ctx),
    ]),
  ]);
}

function buildStandardReport(ctx) {
  const tone = ctx.toneConfig;
  return joinBlocks([
    buildHeadline(ctx),
    profileLine(ctx, 48),
    joinLines([
      tone.intro(ctx),
      ctx.open ? tone.open(ctx.open) : "",
      ctx.result ? tone.result(ctx.result) : "",
    ]),
    section("反応の流れ", [
      bullet("序盤", ctx.early),
      bullet("中盤", ctx.middle),
    ]),
    section("振り返り", [
      ctx.good ? `- 良かった点: ${ctx.good}` : "",
      ctx.reflection ? `- 反省点: ${ctx.reflection}` : "",
      ctx.next ? `- 次回改善: ${ctx.next}` : "",
    ]),
    ctx.memo ? section("メモ", [ctx.memo]) : "",
  ]);
}

function buildDetailedReport(ctx) {
  const tone = ctx.toneConfig;
  return joinBlocks([
    buildHeadline(ctx),
    profileLine(ctx, 48),
    joinLines([
      tone.intro(ctx),
      ctx.open ? tone.open(ctx.open) : "",
    ]),
    section("流れ", [
      bullet("オープン", ctx.open),
      bullet("序盤反応", ctx.early),
      bullet("中盤反応", ctx.middle),
      bullet("結果", ctx.result),
    ]),
    joinLines([
      ctx.good ? tone.good(ctx.good) : "",
      ctx.reflection ? tone.reflection(ctx.reflection) : "",
      ctx.next ? tone.next(ctx.next) : "",
    ]),
    section("次回に向けた整理", [
      ctx.good ? `- 継続すること: ${ctx.good}` : "",
      ctx.reflection ? `- 修正すること: ${ctx.reflection}` : "",
      ctx.next ? `- 次に試すこと: ${ctx.next}` : "",
    ]),
    ctx.memo ? section("自由メモ", [ctx.memo]) : "",
    tone.closing(ctx),
  ]);
}

function buildTweetReport(ctx) {
  const builder = TWEET_BUILDERS[ctx.length] || TWEET_BUILDERS.standard;
  return builder(ctx);
}

function buildTweetShortReport(ctx) {
  return oneSentence([
    buildTweetHeadline(ctx),
    profileLine(ctx, 32),
    compactLine(tweetLabel(ctx, "opponent"), ctx.opponent, 18),
    pickLine(ctx, "short-main", [
      compactLine(tweetLabel(ctx, "result"), ctx.result, 24),
      compactLine(tweetLabel(ctx, "open"), ctx.open, 22),
      compactLine(tweetLabel(ctx, "reaction"), ctx.early, 22),
    ]),
    pickLine(ctx, "short-sub", [
      compactLine(tweetLabel(ctx, "good"), ctx.good, 18),
      compactLine(tweetLabel(ctx, "reflection"), ctx.reflection, 18),
      compactLine(tweetLabel(ctx, "next"), ctx.next, 18),
    ]),
    slangLine(ctx),
    pickupComment(ctx, true),
  ]);
}

function buildTweetStandardReport(ctx) {
  return fitLinesToLimit([
    buildTweetHeadline(ctx),
    profileLine(ctx, 36),
    compactLine(tweetLabel(ctx, "opponent"), ctx.opponent, 20),
    pickLine(ctx, "standard-main", [
      compactLine(tweetLabel(ctx, "result"), ctx.result, 26),
      compactLine(tweetLabel(ctx, "open"), ctx.open, 24),
      compactReaction(ctx),
    ]),
    compactLine(tweetLabel(ctx, "good"), ctx.good, 20),
    compactLine(tweetLabel(ctx, "next"), ctx.next, 20),
    slangLine(ctx),
    pickupComment(ctx),
    tweetTags(ctx),
  ]);
}

function buildTweetDetailedReport(ctx) {
  return fitLinesToLimit([
    buildTweetHeadline(ctx),
    profileLine(ctx, 40),
    compactLine(tweetLabel(ctx, "opponent"), ctx.opponent, 22),
    compactLine(tweetLabel(ctx, "open"), ctx.open, 24),
    compactReaction(ctx),
    compactLine(tweetLabel(ctx, "result"), ctx.result, 26),
    compactLine(tweetLabel(ctx, "good"), ctx.good, 22),
    compactLine(tweetLabel(ctx, "reflection"), ctx.reflection, 22),
    compactLine(tweetLabel(ctx, "next"), ctx.next, 22),
    slangLine(ctx),
    pickupComment(ctx),
    tweetTags(ctx),
  ]);
}

function buildHeadline(ctx) {
  const meta = [ctx.area, ctx.displayDate].filter(Boolean).join(" / ");
  return meta ? `【即報】${meta}` : "【即報】";
}

function buildTweetHeadline(ctx) {
  const separator = pick(ctx, "headline-separator", [" / ", "｜", " "]);
  const meta = [ctx.area, ctx.displayDate].filter(Boolean).join(separator);
  return meta ? `【即報】${meta}` : "【即報】";
}

function section(title, lines) {
  const body = lines.filter(Boolean);
  return body.length ? [`■ ${title}`, ...body].join("\n") : "";
}

function bullet(label, value) {
  return value ? `- ${label}: ${value}` : "";
}

function joinBlocks(blocks) {
  return blocks.filter(Boolean).join("\n\n");
}

function joinLines(lines) {
  return lines.filter(Boolean).join("\n");
}

function fitLinesToLimit(lines, maxLength = MAX_REPORT_CHARS) {
  const selected = [];

  for (const line of lines.filter(Boolean)) {
    const candidate = [...selected, line].join("\n");
    if (charLength(candidate) <= maxLength) {
      selected.push(line);
    }
  }

  if (!selected.length) {
    return truncateText(lines.find(Boolean) || "", maxLength);
  }

  return selected.join("\n");
}

function oneSentence(parts) {
  const text = parts
    .filter(Boolean)
    .map(stripEndingPunctuation)
    .filter(Boolean)
    .join("、");

  return limitReport(text ? `${text}。` : "");
}

function stripEndingPunctuation(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[。．.!！?？]+$/u, "");
}

function limitReport(report, maxLength = MAX_REPORT_CHARS) {
  const text = String(report || "").trim();
  return charLength(text) <= maxLength ? text : truncateText(text, maxLength);
}

function charLength(value) {
  return Array.from(String(value || "")).length;
}

function firstPresent(lines) {
  return lines.find(Boolean) || "";
}

function pickLine(ctx, key, lines) {
  const available = lines.filter(Boolean);
  return available.length ? pick(ctx, key, available) : "";
}

function compactLine(label, value, maxLength) {
  return value ? `${label}: ${tweetText(value, maxLength)}` : "";
}

function profileLine(ctx, maxLength = 36) {
  const text = profileText(ctx, maxLength - 4);
  return text ? `案件: ${text}` : "";
}

function profileText(ctx, maxLength = 32) {
  if (!ctx.includeProfile) {
    return "";
  }

  const parts = [
    formatAge(ctx.age),
    tweetText(ctx.occupation, 8),
    formatPrefixedValue("スト", ctx.streetValue),
    formatCup(ctx.cup),
    formatPrefixedValue("スペ", ctx.specValue),
    formatPrefixedValue("JOJO", ctx.jojo),
  ].filter(Boolean);

  return parts.length ? truncateText(parts.join("/"), maxLength) : "";
}

function formatAge(value) {
  const text = tweetText(value, 4);
  if (!text) {
    return "";
  }

  return /歳$/.test(text) ? text : `${text}歳`;
}

function formatPrefixedValue(prefix, value) {
  const text = tweetText(value, 6);
  if (!text) {
    return "";
  }

  return text.startsWith(prefix) ? text : `${prefix}${text}`;
}

function formatCup(value) {
  const text = tweetText(value, 6);
  if (!text) {
    return "";
  }

  return /cup|カップ/i.test(text) ? text : `${text}cup`;
}

function compactReaction(ctx) {
  const early = tweetText(ctx.early, 18);
  const middle = tweetText(ctx.middle, 18);
  const label = tweetLabel(ctx, "reaction");

  if (early && middle) {
    const arrow = pick(ctx, "reaction-arrow", [" → ", "からの", "、"]);
    return `${label}: ${early}${arrow}${middle}`;
  }

  return early || middle ? `${label}: ${early || middle}` : "";
}

function tweetText(value, maxLength = 34) {
  return truncateText(cleanMultiline(value).replace(/[。．.]+$/u, ""), maxLength);
}

function truncateText(value, maxLength) {
  const chars = Array.from(value);
  if (chars.length <= maxLength) {
    return value;
  }

  return `${chars.slice(0, maxLength - 1).join("")}…`;
}

function pickupComment(ctx, compact = false) {
  const text = `${ctx.result} ${ctx.good} ${ctx.reflection} ${ctx.next}`;
  const resultWin = /満即|即|即確|即確アポ|連絡先|交換|成功|OK|合流|アポ|通りそう/i.test(ctx.result);
  const resultMiss = /至らず|解散|NG|失敗/i.test(ctx.result);
  const hasWin = /満即|即|即確|即確アポ|連絡先|交換|成功|OK|合流|アポ|刺さ|笑顔|盛り上|温度感|上が|通りそう|目ビーム|パワギラ/i.test(text);
  const hasMiss = /至らず|解散|NG|失敗|警戒|遅れ|反省|ミス|詰ま|課題|散った/i.test(text);
  const suffix = compact ? "-compact" : "";

  if (resultWin) {
    return pick(ctx, `comment-result-win${suffix}`, compact
      ? [
          "満即きもちえぇー",
          "即確アポで勝ち",
          "パワギラ即の流れ",
          "目ビーム刺さり",
        ]
      : [
          "満即！きもちえぇー。",
          "満即。これはきもちえぇー。",
          "勝ち。きもちえぇー。",
          "流れ良すぎ。満即！",
          "今日のこれは満即案件。",
          "即確アポ。これは勝ち。",
          "パワギラ即の流れ。満即！",
          "目ビーム刺さった。きもちえぇー。",
        ]);
  }

  if (resultMiss) {
    return pick(ctx, `comment-result-miss${suffix}`, compact
      ? [
          "次で回収",
          "種まき完了",
          "勝ち筋は見えた",
          "修正して次",
        ]
      : [
          "刺さりは見えた。次で回収。",
          "今日は種まき。次で取る。",
          "反省あり。でも勝ち筋はある。",
          "ここは修正して次。",
        ]);
  }

  if (hasWin) {
    return pick(ctx, `comment-win${suffix}`, compact
      ? [
          "感触アリ",
          "次いけるやつ",
          "勝ち筋見えた",
          "目ビーム通った",
        ]
      : [
          "感触アリ。きもちえぇー。",
          "これは次いけるやつ。",
          "温度感アリ。勝ち筋見えた。",
          "刺さり確認。きもちえぇー。",
          "目ビーム通った。感触アリ。",
          "即確アポ見えた。次で回収。",
          "パワギラ感あり。これは強い。",
        ]);
  }

  if (hasMiss) {
    return pick(ctx, `comment-miss${suffix}`, compact
      ? [
          "次で回収",
          "種まき完了",
          "勝ち筋はある",
          "パワギラ抑える",
        ]
      : [
          "刺さりは見えた。次で回収。",
          "今日は種まき。次で取る。",
          "反省あり。でも勝ち筋はある。",
          "ここは修正して次。",
          "目ビーム足りず。次で修正。",
          "パワギラ出しすぎ。次は抑える。",
        ]);
  }

  return pick(ctx, `comment-neutral${suffix}`, compact
    ? [
        "これは勝ち筋",
        "次もこのノリ",
        "温度感拾えた",
        "即確アポ狙い",
      ]
    : [
        "これは勝ち筋。",
        "次もこのノリ。",
        "温度感拾えた。よし。",
        "悪くない。継続。",
        "目ビーム強めで継続。",
        "即確アポまで持っていく。",
      ]);
}

function slangLine(ctx) {
  const text = `${ctx.open} ${ctx.early} ${ctx.middle} ${ctx.result} ${ctx.good}`;
  const resultWin = /満即|即|即確|即確アポ|連絡先|交換|成功|OK|合流|アポ|通りそう/i.test(text);
  const options = resultWin
    ? [
        "一言: 即確アポ見えた",
        "一言: パワギラ即の流れ",
        "一言: 目ビーム刺さり",
        "一言: 回収ムーブ強め",
      ]
    : [
        "一言: 目ビーム意識",
        "一言: 即確アポ狙い",
        "一言: パワギラは抑えめ",
        "一言: 刺さり待ち",
      ];

  return pick(ctx, "slang-line", options);
}

function tweetTags(ctx) {
  const tags = ["#即報"];
  const text = `${ctx.result} ${ctx.good} ${ctx.reflection} ${ctx.next}`;
  const resultWin = /満即|即|即確|即確アポ|連絡先|交換|成功|OK|合流|アポ|通りそう/i.test(text);

  tags.push(pick(ctx, "tag-main", ["#ナンパ", "#声かけ", "#現場メモ", "#目ビーム"]));

  if (resultWin && maybe(ctx, "tag-win", 0.7)) {
    tags.push(pick(ctx, "tag-win-label", ["#満即", "#即確アポ", "#パワギラ即"]));
  }

  if (ctx.good || ctx.reflection || ctx.next) {
    tags.push(pick(ctx, "tag-review", ["#振り返り", "#反省メモ", "#改善"]));
  }

  return [...new Set(tags)].slice(0, 4).join(" ");
}

function tweetLabel(ctx, type) {
  const labels = {
    opponent: ["相手", "系統", "相手感"],
    open: ["入り", "IN", "オープン"],
    early: ["序盤", "初動", "序盤反応"],
    middle: ["中盤", "展開", "中盤反応"],
    reaction: ["反応", "温度感", "返り"],
    result: ["結果", "着地", "回収"],
    good: ["良", "刺さり", "良かった"],
    reflection: ["反省", "課題", "修正"],
    next: ["次", "次回", "次やる"],
  };

  return pick(ctx, `label-${type}`, labels[type] || [type]);
}

function pick(ctx, key, options) {
  if (!options.length) {
    return "";
  }

  return options[Math.floor(seedRandom(ctx, key) * options.length)];
}

function maybe(ctx, key, probability) {
  return seedRandom(ctx, key) < probability;
}

function seedRandom(ctx, key) {
  const seed = [
    ctx.seed,
    key,
    ctx.area,
    ctx.opponent,
    ctx.age,
    ctx.occupation,
    ctx.streetValue,
    ctx.cup,
    ctx.specValue,
    ctx.jojo,
    ctx.open,
    ctx.early,
    ctx.middle,
    ctx.result,
    ctx.good,
    ctx.reflection,
    ctx.next,
    ctx.memo,
    ctx.includeProfile,
    ctx.bulkMemo,
  ].join("|");
  const random = createSeededRandom(seed);
  return random();
}

function createSeededRandom(seed) {
  let state = hashString(seed) || 0x6d2b79f5;

  return function random() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value) {
  let hash = 2166136261;

  for (const char of String(value)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createRandomSeed() {
  const values = new Uint32Array(1);

  if (globalThis.crypto && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(values);
  } else {
    values[0] = Math.floor(Math.random() * 0xffffffff);
  }

  return values[0].toString(36).toUpperCase().slice(-6).padStart(6, "0");
}

function toSentence(value) {
  const text = cleanMultiline(value);
  if (!text) {
    return "";
  }
  return /[。．.!！?？]$/.test(text) ? text : `${text}。`;
}

function cleanMultiline(value) {
  return String(value || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" / ");
}

function formatDateTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function hasReportInput(ctx) {
  return FIELD_KEYS.some((key) => key !== "datetime" && Boolean(ctx[key])) || Boolean(ctx.datetime) || Boolean(ctx.bulkMemo);
}

function parseBulkMemo(value) {
  const lines = String(value || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const parsed = {};
  const unlabeled = [];

  for (const line of lines) {
    const labeled = line.match(/^([^:：]+)[:：]\s*(.+)$/);
    if (!labeled) {
      unlabeled.push(line);
      continue;
    }

    const key = bulkLabelToKey(labeled[1]);
    if (key) {
      parsed[key] = appendText(parsed[key], labeled[2]);
    } else {
      unlabeled.push(line);
    }
  }

  for (const line of unlabeled) {
    const key = inferBulkLineKey(line);
    parsed[key] = appendText(parsed[key], line);
  }

  return parsed;
}

function bulkLabelToKey(label) {
  const text = String(label || "").trim().toLowerCase();
  const rules = [
    [/^(エリア|場所|area)$/, "area"],
    [/^(日時|日付|date|time)$/, "datetime"],
    [/^(相手|系統|案件|opponent)$/, "opponent"],
    [/^(年齢|age)$/, "age"],
    [/^(職業|仕事|job)$/, "occupation"],
    [/^(スト値|スト|street)$/, "streetValue"],
    [/^(カップ|cup)$/, "cup"],
    [/^(スペ値|スペ|spec)$/, "specValue"],
    [/^(jojo)$/, "jojo"],
    [/^(オープン|入り|in|open)$/, "open"],
    [/^(序盤|初動|序盤反応)$/, "early"],
    [/^(中盤|展開|中盤反応)$/, "middle"],
    [/^(結果|着地|回収|result)$/, "result"],
    [/^(良|良かった|刺さり|good)$/, "good"],
    [/^(反省|課題|修正|reflection)$/, "reflection"],
    [/^(次|次回|改善|next)$/, "next"],
    [/^(メモ|memo)$/, "memo"],
  ];

  const match = rules.find(([pattern]) => pattern.test(text));
  return match ? match[1] : "";
}

function inferBulkLineKey(line) {
  if (/渋谷|新宿|池袋|銀座|六本木|駅|周辺|エリア|場所/.test(line)) {
    return "area";
  }
  if (/歳|才|年齢|20代|30代/.test(line)) {
    return "age";
  }
  if (/OL|看護|美容|学生|JD|職業|会社員|受付|保育/.test(line)) {
    return "occupation";
  }
  if (/スト\s*\d|スト値/.test(line)) {
    return "streetValue";
  }
  if (/(^|[\s/])[A-H]\s*(cup|カップ)?($|[\s/])/i.test(line)) {
    return "cup";
  }
  if (/スペ\s*\d|スペ値/.test(line)) {
    return "specValue";
  }
  if (/JOJO/i.test(line)) {
    return "jojo";
  }
  if (/連絡先|交換|満即|即確|アポ|合流|成功|解散|NG|結果|着地/.test(line)) {
    return "result";
  }
  if (/良|刺さ|目ビーム|温度感|笑顔|盛り上|テンポ/.test(line)) {
    return "good";
  }
  if (/反省|課題|ミス|散った|遅れ|警戒|詰ま/.test(line)) {
    return "reflection";
  }
  if (/次|改善|打診|回収|試す/.test(line)) {
    return "next";
  }
  if (/序盤|初動/.test(line)) {
    return "early";
  }
  if (/中盤|展開/.test(line)) {
    return "middle";
  }
  if (/オープン|入り|イン|声かけ/.test(line)) {
    return "open";
  }
  return "memo";
}

function appendText(current, next) {
  return [current, next].filter(Boolean).join(" / ");
}

function fillSample() {
  applyState({
    tone: "tweet",
    length: "short",
    inputMode: "manual",
    seed: createRandomSeed(),
    area: "渋谷駅周辺",
    datetime: toDateTimeLocalValue(new Date()),
    opponent: "カフェ帰りの綺麗めOL系",
    age: "24",
    occupation: "OL",
    streetValue: "7",
    cup: "D",
    specValue: "8",
    jojo: "有",
    open: "道案内から自然にイン",
    early: "最初だけ警戒。短く返したら笑顔",
    middle: "休日トークで温度感上がり",
    result: "連絡先交換まで完了。次回アポも通りそう",
    good: "目ビームとテンポが刺さった",
    reflection: "クロージング前に少し話題が散った",
    next: "共通点が出たら即確アポ打診",
    memo: "雨で人流速め。立ち位置は改善",
  });
  renderAndSave(true);
  showToast("サンプルを入力しました");
}

function clearInputs() {
  const emptyState = {
    ...DEFAULT_STATE,
    seed: createRandomSeed(),
  };
  for (const key of FIELD_KEYS) {
    emptyState[key] = "";
  }

  applyState(emptyState);
  renderAndSave(true);
  showToast("入力をクリアしました");
}

function randomizeSeed() {
  const field = document.querySelector('[data-control="seed"]');
  if (field) {
    field.value = createRandomSeed();
  }

  renderAndSave(true);
  showToast("シードを変更しました");
}

function toDateTimeLocalValue(date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

async function copyReport() {
  const text = outputText.textContent.trim();
  if (!text) {
    showToast("コピーする内容がありません");
    return;
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      copyWithFallback(text);
    }
    showToast("コピーしました");
  } catch {
    try {
      copyWithFallback(text);
      showToast("コピーしました");
    } catch {
      showToast("コピーに失敗しました");
    }
  }
}

function copyWithFallback(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const successful = document.execCommand("copy");
  document.body.removeChild(textarea);

  if (!successful) {
    throw new Error("Copy command failed");
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}
