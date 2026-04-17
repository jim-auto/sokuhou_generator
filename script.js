"use strict";

const LEGACY_STORAGE_KEY = "sokuhou-generator-state-v1";
const STORAGE_KEY = "sokuhou-generator-state-v2";

const FIELD_KEYS = [
  "area",
  "datetime",
  "opponent",
  "open",
  "early",
  "middle",
  "result",
  "good",
  "reflection",
  "next",
  "memo",
];

const DEFAULT_STATE = {
  tone: "tweet",
  length: "standard",
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
const toast = document.querySelector("#toast");
const saveStatus = document.querySelector("#saveStatus");

let toastTimer = 0;
let saveStatusTimer = 0;

init();

function init() {
  applyState(loadState());
  renderAndSave(false);

  form.addEventListener("input", () => renderAndSave(true));
  form.addEventListener("change", () => renderAndSave(true));
  copyButton.addEventListener("click", copyReport);
  sampleButton.addEventListener("click", fillSample);
  clearButton.addEventListener("click", clearInputs);
}

function collectState() {
  const state = { ...DEFAULT_STATE };

  for (const key of FIELD_KEYS) {
    const field = document.querySelector(`[data-field="${key}"]`);
    state[key] = field ? field.value : "";
  }

  const formData = new FormData(form);
  state.tone = formData.get("tone") || DEFAULT_STATE.tone;
  state.length = formData.get("length") || DEFAULT_STATE.length;

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

  setRadioValue("tone", nextState.tone);
  setRadioValue("length", nextState.length);
}

function setRadioValue(name, value) {
  const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
  const fallback = document.querySelector(`input[name="${name}"][value="${DEFAULT_STATE[name]}"]`);
  (radio || fallback).checked = true;
}

function renderAndSave(shouldSave) {
  const state = collectState();
  outputText.textContent = generateReport(state);

  if (shouldSave) {
    saveState(state);
  }
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }

    const legacySaved = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacySaved) {
      return {
        ...JSON.parse(legacySaved),
        tone: DEFAULT_STATE.tone,
      };
    }

    return DEFAULT_STATE;
  } catch {
    return DEFAULT_STATE;
  }
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
    return buildTweetReport(ctx);
  }

  const builder = REPORT_BUILDERS[ctx.length] || REPORT_BUILDERS.standard;
  return builder(ctx);
}

function normalizeState(state) {
  const normalized = {
    tone: state.tone || DEFAULT_STATE.tone,
    length: state.length || DEFAULT_STATE.length,
  };

  for (const key of FIELD_KEYS) {
    normalized[key] = cleanMultiline(state[key]);
  }

  normalized.displayDate = formatDateTime(normalized.datetime);
  normalized.toneConfig = TONE_CONFIG[normalized.tone] || TONE_CONFIG.formal;

  return normalized;
}

function buildShortReport(ctx) {
  const tone = ctx.toneConfig;
  return joinBlocks([
    buildHeadline(ctx),
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
  return joinLines([
    buildTweetHeadline(ctx),
    firstPresent([
      ctx.result ? `結果: ${tweetText(ctx.result)}` : "",
      ctx.open ? `入り: ${tweetText(ctx.open)}` : "",
      ctx.early ? `反応: ${tweetText(ctx.early)}` : "",
    ]),
    ctx.good ? `良かった: ${tweetText(ctx.good)}` : "",
    ctx.reflection ? `反省: ${tweetText(ctx.reflection)}` : "",
    ctx.next ? `次: ${tweetText(ctx.next)}` : "",
    tweetTags(ctx),
  ]);
}

function buildTweetStandardReport(ctx) {
  return joinLines([
    buildTweetHeadline(ctx),
    ctx.opponent ? `相手: ${tweetText(ctx.opponent)}` : "",
    ctx.open ? `入り: ${tweetText(ctx.open)}` : "",
    ctx.early ? `序盤: ${tweetText(ctx.early)}` : "",
    ctx.middle ? `中盤: ${tweetText(ctx.middle)}` : "",
    ctx.result ? `結果: ${tweetText(ctx.result)}` : "",
    "",
    ctx.good ? `良かった: ${tweetText(ctx.good)}` : "",
    ctx.reflection ? `反省: ${tweetText(ctx.reflection)}` : "",
    ctx.next ? `次やる: ${tweetText(ctx.next)}` : "",
    tweetTags(ctx),
  ]);
}

function buildTweetDetailedReport(ctx) {
  return joinBlocks([
    joinLines([
      buildTweetHeadline(ctx),
      ctx.opponent ? `相手: ${tweetText(ctx.opponent)}` : "",
    ]),
    joinLines([
      ctx.open ? `1. 入り: ${tweetText(ctx.open)}` : "",
      ctx.early ? `2. 序盤: ${tweetText(ctx.early)}` : "",
      ctx.middle ? `3. 中盤: ${tweetText(ctx.middle)}` : "",
      ctx.result ? `4. 結果: ${tweetText(ctx.result)}` : "",
    ]),
    joinLines([
      ctx.good ? `良かった点: ${tweetText(ctx.good)}` : "",
      ctx.reflection ? `反省点: ${tweetText(ctx.reflection)}` : "",
      ctx.next ? `次回: ${tweetText(ctx.next)}` : "",
    ]),
    ctx.memo ? `メモ: ${tweetText(ctx.memo)}` : "",
    tweetTags(ctx),
  ]);
}

function buildHeadline(ctx) {
  const meta = [ctx.area, ctx.displayDate].filter(Boolean).join(" / ");
  return meta ? `【即報】${meta}` : "【即報】";
}

function buildTweetHeadline(ctx) {
  const meta = [ctx.area, ctx.displayDate].filter(Boolean).join(" / ");
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

function firstPresent(lines) {
  return lines.find(Boolean) || "";
}

function tweetText(value) {
  return cleanMultiline(value).replace(/[。．.]+$/u, "");
}

function tweetTags(ctx) {
  const tags = ["#即報"];
  if (ctx.good || ctx.reflection || ctx.next) {
    tags.push("#振り返り");
  }
  return tags.join(" ");
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
  return FIELD_KEYS.some((key) => key !== "datetime" && Boolean(ctx[key])) || Boolean(ctx.datetime);
}

function fillSample() {
  applyState({
    tone: "tweet",
    length: "standard",
    area: "渋谷駅周辺",
    datetime: toDateTimeLocalValue(new Date()),
    opponent: "20代後半・落ち着いた雰囲気",
    open: "道案内の話題から自然に入り、相手の移動目的を確認",
    early: "最初は少し警戒あり。こちらが短く返すと笑顔が出て会話量が増えた",
    middle: "仕事終わりの流れから休日の話題へ展開。共通点が見つかって温度感は上がった",
    result: "会話は約5分。連絡先交換までは至らず、改札前で解散",
    good: "声量と距離感を抑えたことで、序盤の警戒を強めずに会話へ入れた",
    reflection: "中盤で話題を広げすぎて、次の打診までの流れが少し遅れた",
    next: "共通点が出た時点で一度軽く打診し、反応を見て深掘りする",
    memo: "雨で人の流れが速め。立ち止まりやすい場所選びは再検討",
  });
  renderAndSave(true);
  showToast("サンプルを入力しました");
}

function clearInputs() {
  const emptyState = { ...DEFAULT_STATE };
  for (const key of FIELD_KEYS) {
    emptyState[key] = "";
  }

  applyState(emptyState);
  renderAndSave(true);
  showToast("入力をクリアしました");
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
