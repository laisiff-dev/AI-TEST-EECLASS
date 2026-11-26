/* app.js — ee-Class 智慧考題轉題庫整合系統 UI 控制器 */
(function () {
  "use strict";

  const QB = window.ExamQB;
  const $ = (id) => document.getElementById(id);

  const state = {
    questions: [],
    sourceFileName: "exam",
    pendingBinaryBase64: null,
    pendingMimeType: "",
    pendingFileName: "",
    pendingTextExtracted: false,
    activeFilter: "all",
    searchKeyword: "",
    fontSize: "md",
    lastNormSummary: "",
    validatorQuestions: [],
    validatorFileName: "exam",
    lectureText: "",
    lectureFileName: "",
    lecturePdfBase64: null,
    lectureMimeType: "",
    lectureIsScanned: false,
  };

  const STORAGE_KEYS = {
    theme: "exam_qb_theme",
    apiKey: "exam_qb_gemini_key",
    checklist: "exam_qb_gemini_checklist_v1",
    fontSize: "exam_qb_font_size",
  };

  // ===== Toast =====
  let toastTimer = null;
  function showToast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
  }

  // ===== 主題切換 =====
  function initTheme() {
    const saved = localStorage.getItem(STORAGE_KEYS.theme);
    if (saved === "light" || saved === "dark") {
      document.documentElement.setAttribute("data-theme", saved);
    }
    updateThemeButton();
    $("btn-theme").addEventListener("click", () => {
      const cur = document.documentElement.getAttribute("data-theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const isDark = cur ? cur === "dark" : prefersDark;
      const next = isDark ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem(STORAGE_KEYS.theme, next);
      updateThemeButton();
    });
  }

  function updateThemeButton() {
    const cur = document.documentElement.getAttribute("data-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = cur ? cur === "dark" : prefersDark;
    $("btn-theme").textContent = isDark ? "☀️ 亮色" : "🌙 暗色";
  }

  // ===== 主分頁切換 =====
  function switchMainTab(tabName) {
    document.querySelectorAll(".nav-tab").forEach((btn) => {
      btn.setAttribute("aria-selected", btn.dataset.tab === tabName ? "true" : "false");
    });
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.hidden = panel.id !== `tab-${tabName}`;
    });
    try {
      history.replaceState(null, "", `#${tabName}`);
    } catch (_) {}
  }

  function initTabs() {
    document.querySelectorAll(".nav-tab").forEach((btn) => {
      btn.addEventListener("click", () => switchMainTab(btn.dataset.tab));
    });
    const hash = location.hash.replace(/^#/, "");
    if (["converter", "editor", "validator", "prompts", "guide"].includes(hash)) {
      switchMainTab(hash);
    }
  }

  // ===== 通用工具 =====
  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copyText(text, okMsg) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(okMsg || "已複製到剪貼簿");
    } catch (_) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      showToast(okMsg || "已複製到剪貼簿");
    }
  }

  function baseFileName(name) {
    return (name || "exam").replace(/\.[^.]+$/, "") || "exam";
  }

  function arrayBufferToBase64(buf) {
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function clearPendingBinary() {
    state.pendingBinaryBase64 = null;
    state.pendingMimeType = "";
    state.pendingFileName = "";
    state.pendingTextExtracted = false;
  }

  // ===== Tab 1：全格式匯入與解析 =====
  function initConverter() {
    const savedKey = localStorage.getItem(STORAGE_KEYS.apiKey);
    if (savedKey) {
      $("gemini-api-key").value = savedKey;
      $("gemini-save-key").checked = true;
    }

    $("gemini-save-key").addEventListener("change", syncApiKeyStorage);
    $("gemini-api-key").addEventListener("input", syncApiKeyStorage);

    document.querySelectorAll('input[name="parse-mode"]').forEach((r) => {
      r.addEventListener("change", updateParseModeUI);
    });
    $("gemini-model").addEventListener("change", () => {
      $("gemini-custom-model-wrap").hidden = $("gemini-model").value !== "__custom__";
    });
    updateParseModeUI();

    // Drag & Drop 檔案
    const dz = $("drop-zone");
    const fi = $("file-input");
    dz.addEventListener("click", () => fi.click());
    dz.addEventListener("dragover", (e) => {
      e.preventDefault();
      dz.classList.add("dragover");
    });
    dz.addEventListener("dragleave", () => dz.classList.remove("dragover"));
    dz.addEventListener("drop", (e) => {
      e.preventDefault();
      dz.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleExamFile(e.dataTransfer.files[0]);
      }
    });
    fi.addEventListener("change", () => {
      if (fi.files && fi.files[0]) handleExamFile(fi.files[0]);
      fi.value = "";
    });

    // 三個一鍵載入範例
    $("btn-load-sample").addEventListener("click", () => {
      clearPendingBinary();
      state.sourceFileName = "sample";
      $("default-category").value = "資訊安全";
      $("raw-text").value = QB.SAMPLE_EXAM_TEXT;
      setFileStatus("alert-ok", "已載入官方 9 題練習範例（Tools_QB sample.docx 內容，五種題型完整涵蓋）");
      runParse();
    });

    $("btn-load-sdgs").addEventListener("click", () => {
      clearPendingBinary();
      state.sourceFileName = "SDGs_永續發展測驗";
      $("default-category").value = "";
      $("raw-text").value = QB.SAMPLE_SDGS_TEXT;
      setFileStatus("alert-purple", "已載入 SDGs 自由排版示範（含 NotebookLM 黏合選項、四欄解答表、題首括號答案、①②③④、底線填空）");
      runParse();
    });

    $("btn-load-env").addEventListener("click", () => {
      clearPendingBinary();
      state.sourceFileName = "環境微生物學_範例";
      $("default-category").value = "";
      $("raw-text").value = QB.SAMPLE_ENV_TEXT;
      setFileStatus("alert-ok", "已載入環境微生物學 5 大題型多章節範例（AI-TEST-EECLASS 範例）");
      runParse();
    });

    // 第一階段手動預覽「自由格式智慧重構」
    $("btn-auto-normalize").addEventListener("click", () => {
      const raw = $("raw-text").value;
      if (!raw.trim()) {
        showToast("請先貼上或上傳考題文字");
        return;
      }
      const norm = QB.normalizeFreeformQuizText(raw);
      $("raw-text").value = norm.normalizedText;
      if (norm.detectedCategory && !$("default-category").value.trim() && (!norm.stats || norm.stats.detectedChapters <= 1)) {
        $("default-category").value = norm.detectedCategory;
      }
      const banner = $("parse-banner");
      banner.className = "alert alert-purple";
      banner.textContent = `🪄 第一階段智慧重構完成！${norm.summaryMessage}（您可檢查上方文字，再點「🚀 開始解析考題」）`;
      banner.hidden = false;
      showToast("已完成自由格式智慧重構");
    });

    $("btn-clear-input").addEventListener("click", () => {
      clearPendingBinary();
      state.sourceFileName = "exam";
      $("raw-text").value = "";
      $("file-status").hidden = true;
      $("parse-banner").hidden = true;
    });

    $("btn-parse").addEventListener("click", runParse);
  }

  function setFileStatus(cls, text) {
    const el = $("file-status");
    el.className = `alert ${cls}`;
    el.textContent = text;
    el.hidden = false;
  }

  function syncApiKeyStorage() {
    if ($("gemini-save-key").checked) {
      localStorage.setItem(STORAGE_KEYS.apiKey, $("gemini-api-key").value.trim());
    } else {
      localStorage.removeItem(STORAGE_KEYS.apiKey);
    }
  }

  function getSelectedParseMode() {
    const checked = document.querySelector('input[name="parse-mode"]:checked');
    return checked ? checked.value : "offline";
  }

  function updateParseModeUI() {
    $("gemini-config").hidden = getSelectedParseMode() !== "gemini";
  }

  async function handleExamFile(file) {
    const name = file.name || "exam";
    const ext = name.toLowerCase().split(".").pop();
    state.sourceFileName = baseFileName(name);
    clearPendingBinary();

    if (ext === "doc" || ext === "xls") {
      setFileStatus("alert-error", `不支援舊版二進位格式 (.${ext})，請先另存為 .docx / .xlsx / .pdf 再上傳。`);
      return;
    }

    // JSON 題庫備份還原
    if (ext === "json") {
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const list = Array.isArray(data) ? data : Array.isArray(data.questions) ? data.questions : null;
        if (!list) throw new Error("JSON 內找不到 questions 陣列");
        state.questions = list.map((item) => QB.normalizeQuestion(item, data.category || ""));
        if (data.category) $("default-category").value = data.category;
        setFileStatus("alert-ok", `已還原 JSON 題庫備份：${name}（共 ${state.questions.length} 題），已切換至編輯器。`);
        renderEditor();
        switchMainTab("editor");
      } catch (err) {
        setFileStatus("alert-error", `還原 JSON 失敗：${err.message}`);
      }
      return;
    }

    // PDF：優先離線抽取文字（免 API Key！）；若為純掃描圖片 PDF 則自動切至 Gemini AI 視覺辨識
    if (ext === "pdf") {
      try {
        setFileStatus("alert", `⏳ 正在離線解析 PDF：${name}，請稍候...`);
        const buf = await file.arrayBuffer();
        state.pendingBinaryBase64 = arrayBufferToBase64(buf);
        state.pendingMimeType = "application/pdf";
        state.pendingFileName = name;

        const pdfRes = await QB.extractPdfText(buf.slice(0));
        if (!pdfRes.isLikelyScanned) {
          state.pendingTextExtracted = true;
          $("raw-text").value = pdfRes.text;
          setFileStatus(
            "alert-ok",
            `已離線抽取 PDF 文字：${name}（共 ${pdfRes.pageCount} 頁、${pdfRes.text.length} 字）。可直接按「🚀 開始解析考題」（免 API Key）；若原檔為複雜多欄／圖表排版，亦可切換至「✨ Gemini AI 全能解析」直讀原檔！`
          );
        } else {
          state.pendingTextExtracted = false;
          $("raw-text").value = `[已載入掃描型 PDF：${name}（共 ${pdfRes.pageCount} 頁，${(file.size / 1024).toFixed(1)} KB）]\n此 PDF 沒有內嵌可選取文字，已自動切換至 Gemini AI 多模態 OCR 辨識模式。`;
          document.querySelector('input[name="parse-mode"][value="gemini"]').checked = true;
          updateParseModeUI();
          setFileStatus(
            "alert-warn",
            `偵測到「${name}」（共 ${pdfRes.pageCount} 頁）為掃描圖片型 PDF（無文字層），已自動切換為 ✨ Gemini AI 模式；填入 API Key 後按「🚀 開始解析考題」即可辨識！`
          );
        }
      } catch (err) {
        setFileStatus("alert-error", `讀取 PDF 失敗：${err.message}`);
      }
      return;
    }

    // 考卷照片（PNG / JPG / WebP）→ 自動切換 Gemini AI 多模態解析
    const mimeMap = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
    };
    if (mimeMap[ext]) {
      try {
        const buf = await file.arrayBuffer();
        state.pendingBinaryBase64 = arrayBufferToBase64(buf);
        state.pendingMimeType = mimeMap[ext];
        state.pendingFileName = name;
        state.pendingTextExtracted = false;
        $("raw-text").value = `[已載入考卷照片：${name}（${mimeMap[ext]}，${(file.size / 1024).toFixed(1)} KB）]\n將由 Gemini AI 多模態引擎直接辨識圖片考題。`;
        document.querySelector('input[name="parse-mode"][value="gemini"]').checked = true;
        updateParseModeUI();
        setFileStatus("alert-purple", `已載入 ${name}！請確認下方已填入 Gemini API Key，再點擊「🚀 開始解析考題」。`);
      } catch (err) {
        setFileStatus("alert-error", `讀取圖片失敗：${err.message}`);
      }
      return;
    }

    // Word (.docx)
    if (ext === "docx") {
      try {
        const buf = await file.arrayBuffer();
        const text = await QB.extractDocxText(buf);
        $("raw-text").value = text;
        setFileStatus("alert-ok", `已離線擷取 Word 考題（含表格）：${name}（共 ${text.length} 字）。按「🚀 開始解析考題」即可自動重構並轉換！`);
      } catch (err) {
        setFileStatus("alert-error", `讀取 .docx 失敗：${err.message}`);
      }
      return;
    }

    // Excel (.xlsx)
    if (ext === "xlsx") {
      try {
        const buf = await file.arrayBuffer();
        const matrix = await QB.extractXlsxRows(buf);
        const directQs = QB.parseTableMatrixToQuestions(matrix, $("default-category").value.trim());
        if (directQs && directQs.length > 0) {
          state.questions = directQs;
          state.lastNormSummary = `由 Excel (${name}) 直接辨識表格欄位，共匯入 ${directQs.length} 題。`;
          setFileStatus("alert-ok", `已離線讀取 Excel 考題表：${name}（共 ${directQs.length} 題），已切換至編輯器核對！`);
          renderEditor();
          switchMainTab("editor");
        } else {
          const text = matrix.map((r) => r.join(" ")).join("\n");
          $("raw-text").value = text;
          setFileStatus("alert-warn", `已抽取 Excel 文字（${matrix.length} 列），未偵測到標準標題列，已放入下方文字框供規則或 AI 解析。`);
        }
      } catch (err) {
        setFileStatus("alert-error", `讀取 .xlsx 失敗：${err.message}`);
      }
      return;
    }

    // CSV（若為 version: 4 直接導入驗收器，否則嘗試表格或文字解析）
    if (ext === "csv") {
      const buf = await file.arrayBuffer();
      const { text, encoding } = QB.decodeFileBytesSmart(buf);
      if (/^\s*version:\s*4/i.test(text)) {
        $("csv-paste-input").value = text;
        state.validatorFileName = state.sourceFileName;
        switchMainTab("validator");
        runCsvValidation();
        showToast(`偵測到 ee-Class 27 欄 CSV（${encoding}），已自動進入驗收分頁`);
        return;
      }
      const { rows } = QB.parseCsvMatrix(text);
      const tableQs = QB.parseTableMatrixToQuestions(rows, $("default-category").value.trim());
      if (tableQs && tableQs.length > 0) {
        state.questions = tableQs;
        state.lastNormSummary = `由 CSV 表格 (${name}) 自動對應欄位，共匯入 ${tableQs.length} 題。`;
        renderEditor();
        switchMainTab("editor");
        showToast(`已從表格 CSV 匯入 ${tableQs.length} 題`);
        return;
      }
      $("raw-text").value = text;
      setFileStatus("alert-ok", `已讀取 CSV 文字：${name}（${encoding}）。`);
      return;
    }

    // 純文字 / Markdown / TSV
    if (["txt", "md", "tsv"].includes(ext)) {
      const buf = await file.arrayBuffer();
      const { text, encoding } = QB.decodeFileBytesSmart(buf);
      $("raw-text").value = text;
      setFileStatus("alert-ok", `已讀取文字檔：${name}（編碼：${encoding}，共 ${text.length} 字）。`);
      return;
    }

    setFileStatus("alert-warn", `不支援的副檔名 (.${ext})，請改用 .docx、.xlsx、.pdf、圖片、.txt、.md、.csv 或 .json。`);
  }

  async function runParse() {
    const mode = getSelectedParseMode();
    const defaultCategory = $("default-category").value.trim();
    const rawText = $("raw-text").value.trim();
    const banner = $("parse-banner");

    if (!state.pendingBinaryBase64 && !rawText) {
      banner.className = "alert alert-warn";
      banner.textContent = "請先上傳考題檔、貼上考題文字，或點擊右上角任一範例按鈕試用。";
      banner.hidden = false;
      return;
    }

    if (mode === "offline") {
      if (state.pendingBinaryBase64 && !state.pendingTextExtracted) {
        banner.className = "alert alert-warn";
        banner.textContent = "此檔案為掃描圖片型 PDF 或考卷照片（無內嵌文字層），需切換到「✨ Gemini AI 全能解析」模式並填入 API Key 進行視覺辨識。";
        banner.hidden = false;
        return;
      }
      const parsed = QB.parseExamText(rawText, defaultCategory, { autoNormalize: true });
      state.questions = parsed;
      state.lastNormSummary = parsed.normInfo ? parsed.normInfo.summaryMessage : "";
      if (parsed.length === 0) {
        banner.className = "alert alert-warn";
        banner.textContent = "離線規則解析未能切出題目。建議改切至「✨ Gemini AI 全能解析」處理非標準排版，或先點「🪄 自由格式智慧重構」檢查格式。";
        banner.hidden = false;
        return;
      }
      banner.className = "alert alert-ok";
      banner.textContent = `解析完成！共擷取 ${parsed.length} 題。${state.lastNormSummary}`;
      banner.hidden = false;
      state.activeFilter = "all";
      state.searchKeyword = "";
      renderEditor();
      switchMainTab("editor");
      showToast(`已成功解析 ${parsed.length} 題`);
      return;
    }

    // Gemini AI 多模態全能解析
    const apiKey = $("gemini-api-key").value.trim();
    const modelSel = $("gemini-model").value;
    const model = modelSel === "__custom__" ? $("gemini-custom-model").value.trim() : modelSel;

    const btn = $("btn-parse");
    const origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "⏳ Gemini AI 解析中...";
    banner.className = "alert alert-purple";
    banner.textContent = `正在呼叫 Gemini (${model}) 進行智慧解析，請稍候...`;
    banner.hidden = false;

    try {
      const res = await QB.callGeminiParser({
        apiKey,
        model,
        text: rawText,
        binaryBase64: state.pendingBinaryBase64,
        mimeType: state.pendingMimeType,
        fileName: state.pendingFileName,
        defaultCategory,
      });
      state.questions = res.questions;
      state.lastNormSummary = `由 Gemini AI (${model}) 智慧解析共 ${res.questions.length} 題。${res.notes ? " 備註：" + res.notes : ""}`;
      banner.className = "alert alert-ok";
      banner.textContent = state.lastNormSummary;
      state.activeFilter = "all";
      state.searchKeyword = "";
      renderEditor();
      switchMainTab("editor");
      showToast(`Gemini AI 解析完成，共 ${res.questions.length} 題`);
    } catch (err) {
      banner.className = "alert alert-error";
      banner.textContent = err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = origText;
    }
  }

  // ===== Tab 2：題目預覽、編輯、篩選與多格式匯出 =====
  function initEditorControls() {
    const savedSize = localStorage.getItem(STORAGE_KEYS.fontSize);
    if (["sm", "md", "lg", "xl"].includes(savedSize)) state.fontSize = savedSize;
    applyFontSize();

    document.querySelectorAll(".btn-font-size").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.fontSize = btn.dataset.size;
        localStorage.setItem(STORAGE_KEYS.fontSize, state.fontSize);
        applyFontSize();
      });
    });

    document.querySelectorAll(".filter-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.activeFilter = btn.dataset.filter;
        document.querySelectorAll(".filter-pill").forEach((b) => b.classList.toggle("active", b === btn));
        renderEditor();
      });
    });

    $("search-questions").addEventListener("input", (e) => {
      state.searchKeyword = e.target.value.trim().toLowerCase();
      renderEditor();
    });

    $("btn-apply-category").addEventListener("click", () => {
      const cat = $("default-category").value.trim();
      state.questions.forEach((q) => (q.category = cat));
      renderEditor();
      showToast(cat ? `已將全部題目類別設為「${cat}」` : "已清空全部題目類別");
    });

    $("btn-add-question").addEventListener("click", () => {
      state.questions.push(QB.createEmptyQuestion($("default-category").value.trim()));
      state.activeFilter = "all";
      renderEditor();
      const cards = $("questions-list").querySelectorAll(".q-card");
      if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: "smooth", block: "center" });
    });

    $("btn-clear-questions").addEventListener("click", () => {
      if (state.questions.length === 0) return;
      state.questions = [];
      state.lastNormSummary = "";
      renderEditor();
      showToast("已清空編輯器中的所有題目");
    });

    $("btn-export-utf8").addEventListener("click", () => exportQuestions("utf8"));
    $("btn-export-utf8-bom").addEventListener("click", () => exportQuestions("utf8-bom"));
    $("btn-export-big5").addEventListener("click", () => exportQuestions("big5"));
    $("btn-export-gift").addEventListener("click", () => exportQuestions("gift"));
    $("btn-export-json").addEventListener("click", () => exportQuestions("json"));
    $("btn-copy-csv").addEventListener("click", () => {
      copyText(QB.buildCsvUtf8(state.questions), "已複製完整 27 欄 CSV");
    });
    $("btn-preview-csv").addEventListener("click", () => {
      $("csv-preview-text").textContent = QB.buildCsvUtf8(state.questions);
      $("csv-modal").hidden = false;
    });
    $("btn-close-modal").addEventListener("click", () => ($("csv-modal").hidden = true));
    $("csv-modal").addEventListener("click", (e) => {
      if (e.target === $("csv-modal")) $("csv-modal").hidden = true;
    });
    $("btn-modal-copy").addEventListener("click", () => {
      copyText($("csv-preview-text").textContent, "已複製完整 CSV");
    });
    $("chk-allow-invalid").addEventListener("change", updateExportButtonsState);
  }

  function applyFontSize() {
    const list = $("questions-list");
    list.classList.remove("q-font-sm", "q-font-md", "q-font-lg", "q-font-xl");
    list.classList.add(`q-font-${state.fontSize}`);
    document.querySelectorAll(".btn-font-size").forEach((b) => {
      b.classList.toggle("active", b.dataset.size === state.fontSize);
    });
  }

  function renderEditor() {
    $("nav-editor-count").textContent = String(state.questions.length);
    const hasQ = state.questions.length > 0;
    $("editor-empty").hidden = hasQ;
    $("editor-workspace").hidden = !hasQ;

    const stage2 = $("stage2-banner");
    if (hasQ && state.lastNormSummary) {
      stage2.textContent = `🪄 人機協同第二階段：${state.lastNormSummary} 請快速確認下方卡片，通過防呆驗證即可匯出！`;
      stage2.hidden = false;
    } else {
      stage2.hidden = true;
    }

    if (!hasQ) return;

    const validation = QB.validateAll(state.questions);
    renderStats(validation);
    renderQuestionCards(validation);
    updateExportButtonsState();
  }

  function renderStats(validation) {
    const counts = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
    let normCount = 0;
    state.questions.forEach((q) => {
      if (counts[q.type] !== undefined) counts[q.type]++;
      if (q.wasAutoNormalized) normCount++;
    });

    const total = state.questions.length;
    const pass = total - validation.invalidCount;
    const pills = [
      `<span class="stat-pill">共 ${total} 題</span>`,
      `<span class="stat-pill ok">✓ 通過驗證 ${pass}</span>`,
    ];
    if (validation.invalidCount > 0) pills.push(`<span class="stat-pill err">✕ 待修正錯誤 ${validation.invalidCount}</span>`);
    if (validation.warnCount > 0) pills.push(`<span class="stat-pill warn">⚠ 提醒 ${validation.warnCount}</span>`);
    if (normCount > 0) pills.push(`<span class="stat-pill purple">🪄 智慧重構/AI ${normCount}</span>`);
    for (const [k, label] of Object.entries(QB.TYPE_LABELS)) {
      if (counts[k] > 0) pills.push(`<span class="stat-pill">${label} ${counts[k]}</span>`);
    }
    $("stats-bar").innerHTML = pills.join("");
  }

  function matchesFilter(q, v) {
    const f = state.activeFilter;
    if (f === "1" || f === "2" || f === "3" || f === "4" || f === "5") {
      if (q.type !== f) return false;
    } else if (f === "normalized") {
      if (!q.wasAutoNormalized) return false;
    } else if (f === "issues") {
      if (v.errors.length === 0 && v.warnings.length === 0) return false;
    }

    if (state.searchKeyword) {
      const hay = [q.category, q.question, q.answer, q.explanation, ...(q.options || [])]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(state.searchKeyword)) return false;
    }
    return true;
  }

  function renderQuestionCards(validation) {
    const list = $("questions-list");
    list.innerHTML = "";
    let shown = 0;

    state.questions.forEach((q, idx) => {
      const v = validation.perQuestion[idx];
      if (!matchesFilter(q, v)) return;
      shown++;

      const card = document.createElement("article");
      card.className = "q-card" + (v.errors.length ? " has-error" : "") + (v.warnings.length ? " has-warn" : "");

      const statusBadge = v.errors.length
        ? `<span class="badge badge-err">✕ ${v.errors.length} 項錯誤</span>`
        : v.warnings.length
        ? `<span class="badge badge-warn">⚠ ${v.warnings.length} 項提醒</span>`
        : `<span class="badge badge-ok">✓ 格式正確</span>`;

      const normBadge = q.wasAutoNormalized ? `<span class="badge badge-purple" title="${escapeHtml(q.normalizeNote)}">🪄 智慧調整</span>` : "";

      let issuesHtml = "";
      if (v.errors.length || v.warnings.length) {
        issuesHtml =
          `<div class="q-issues">` +
          v.errors.map((m) => `<div class="q-issue err">✕ ${escapeHtml(m)}</div>`).join("") +
          v.warnings.map((m) => `<div class="q-issue warn">⚠ ${escapeHtml(m)}</div>`).join("") +
          `</div>`;
      }

      let answerBlockHtml = "";
      if (q.type === "1") {
        answerBlockHtml = `
          <div>
            <label class="field-label">是非題答案</label>
            <div class="tf-group">
              <label class="tf-btn"><input type="radio" name="tf-${idx}" value="1" ${q.answer === "1" ? "checked" : ""}> (1) 是 / 正確</label>
              <label class="tf-btn"><input type="radio" name="tf-${idx}" value="2" ${q.answer === "2" ? "checked" : ""}> (2) 否 / 錯誤</label>
            </div>
          </div>`;
      } else if (q.type === "2" || q.type === "3") {
        const picks = new Set((q.answer || "").split(",").map((s) => s.trim()).filter(Boolean));
        const inputType = q.type === "2" ? "radio" : "checkbox";
        if (q.options.length === 0) q.options = ["", "", "", ""];
        const rowsHtml = q.options
          .map((opt, oi) => {
            const num = String(oi + 1);
            const letter = String.fromCharCode(65 + oi);
            return `
            <div class="opt-row">
              <input type="${inputType}" name="ans-${idx}" class="opt-pick" data-oi="${oi}" ${picks.has(num) ? "checked" : ""} title="設為正確答案">
              <span class="opt-letter">${letter}</span>
              <input type="text" class="opt-text" data-oi="${oi}" value="${escapeHtml(opt)}" placeholder="選項 ${num} 文字（不含 (A) 前綴）">
              <button type="button" class="btn btn-sm btn-danger-ghost opt-del" data-oi="${oi}" title="刪除此選項">✕</button>
            </div>`;
          })
          .join("");

        answerBlockHtml = `
          <div>
            <div class="card-header" style="margin-bottom:0.4rem">
              <label class="field-label" style="margin:0">選項與答案（勾選左側即為正解；答案欄：<code>${escapeHtml(q.answer || "未選")}</code>）</label>
              <button type="button" class="btn btn-sm opt-add">＋ 新增選項</button>
            </div>
            <div class="options-editor">${rowsHtml}</div>
          </div>`;
      } else if (q.type === "4") {
        answerBlockHtml = `
          <div class="grid-2">
            <div>
              <label class="field-label">填充設定 1：英文大小寫（第 8 欄）</label>
              <select class="f-case">
                <option value="1" ${q.fillCaseFlag === "1" ? "selected" : ""}>1 — 不分英文大小寫</option>
                <option value="2" ${q.fillCaseFlag === "2" ? "selected" : ""}>2 — 區分英文大小寫</option>
              </select>
            </div>
            <div>
              <label class="field-label">填充設定 2：作答順序（第 9 欄）</label>
              <select class="f-order">
                <option value="1" ${q.fillOrderFlag === "1" ? "selected" : ""}>1 — 不考慮順序</option>
                <option value="2" ${q.fillOrderFlag === "2" ? "selected" : ""}>2 — 需考慮順序</option>
              </select>
            </div>
          </div>`;
      } else if (q.type === "5") {
        answerBlockHtml = `
          <div>
            <label class="field-label">問答題參考答案（支援多行）</label>
            <textarea class="f-essay-ans" rows="3" placeholder="輸入參考答案...">${escapeHtml(q.answer)}</textarea>
          </div>`;
      }

      const fillHelperBtn =
        q.type === "4"
          ? `<button type="button" class="btn btn-sm btn-purple btn-wrap-blank" title="反白上方題目中的答案文字後點此按鈕，自動加上 [* *]">✨ 將選取字設為 [*填空*]</button>`
          : "";

      card.innerHTML = `
        <div class="q-card-head">
          <div class="q-head-left">
            <span class="q-num">第 ${idx + 1} 題</span>
            <span class="badge">${escapeHtml(QB.TYPE_LABELS[q.type] || "未知")}</span>
            ${statusBadge}
            ${normBadge}
          </div>
          <div class="btn-row">
            <button type="button" class="btn btn-sm q-up" ${idx === 0 ? "disabled" : ""} title="上移">↑</button>
            <button type="button" class="btn btn-sm q-down" ${idx === state.questions.length - 1 ? "disabled" : ""} title="下移">↓</button>
            <button type="button" class="btn btn-sm btn-danger-ghost q-del">刪除</button>
          </div>
        </div>
        <div class="q-card-body">
          ${issuesHtml}
          <div class="q-meta-row">
            <div>
              <label class="field-label">類別（第 2 欄，可空）</label>
              <input type="text" class="f-cat" value="${escapeHtml(q.category)}" placeholder="例如：資訊安全">
            </div>
            <div>
              <label class="field-label">題型（第 3 欄）</label>
              <select class="f-type">
                <option value="1" ${q.type === "1" ? "selected" : ""}>1 — 是非題</option>
                <option value="2" ${q.type === "2" ? "selected" : ""}>2 — 單選題</option>
                <option value="3" ${q.type === "3" ? "selected" : ""}>3 — 複選題</option>
                <option value="4" ${q.type === "4" ? "selected" : ""}>4 — 填充題</option>
                <option value="5" ${q.type === "5" ? "selected" : ""}>5 — 問答題</option>
              </select>
            </div>
            <div>
              <label class="field-label">難易度（第 7 欄）</label>
              <select class="f-diff">
                <option value="1" ${q.difficulty === "1" ? "selected" : ""}>1 — 容易</option>
                <option value="2" ${q.difficulty === "2" ? "selected" : ""}>2 — 適中</option>
                <option value="3" ${q.difficulty === "3" ? "selected" : ""}>3 — 困難</option>
              </select>
            </div>
          </div>
          <div>
            <div class="card-header" style="margin-bottom:0.3rem">
              <label class="field-label" style="margin:0">題目（第 4 欄）${q.type === "4" ? " — 以 [*答案*] 標記填空處" : ""}</label>
              ${fillHelperBtn}
            </div>
            <textarea class="f-question" rows="2">${escapeHtml(q.question)}</textarea>
          </div>
          ${answerBlockHtml}
          <div>
            <label class="field-label">解說（第 6 欄，可空）</label>
            <input type="text" class="f-exp" value="${escapeHtml(q.explanation)}" placeholder="選填解說文字">
          </div>
        </div>
      `;

      // 事件綁定
      card.querySelector(".f-cat").addEventListener("input", (e) => (q.category = e.target.value));
      card.querySelector(".f-type").addEventListener("change", (e) => {
        q.type = e.target.value;
        if ((q.type === "2" || q.type === "3") && q.options.length === 0) q.options = ["", "", "", ""];
        if (q.type === "4") q.answer = "";
        renderEditor();
      });
      card.querySelector(".f-diff").addEventListener("change", (e) => {
        q.difficulty = e.target.value;
        q.difficultyEstimated = false;
        renderEditor();
      });
      const qTa = card.querySelector(".f-question");
      qTa.addEventListener("change", (e) => {
        q.question = e.target.value;
        renderEditor();
      });
      card.querySelector(".f-exp").addEventListener("input", (e) => (q.explanation = e.target.value));

      const wrapBtn = card.querySelector(".btn-wrap-blank");
      if (wrapBtn) {
        wrapBtn.addEventListener("click", () => {
          const start = qTa.selectionStart;
          const end = qTa.selectionEnd;
          if (end > start) {
            const sel = qTa.value.slice(start, end);
            q.question = qTa.value.slice(0, start) + `[*${sel}*]` + qTa.value.slice(end);
          } else {
            q.question = qTa.value + "[*答案*]";
          }
          renderEditor();
        });
      }

      card.querySelectorAll(`input[name="tf-${idx}"]`).forEach((r) => {
        r.addEventListener("change", () => {
          q.answer = r.value;
          renderEditor();
        });
      });
      card.querySelectorAll(".opt-pick").forEach((inp) => {
        inp.addEventListener("change", () => {
          const picked = [];
          card.querySelectorAll(".opt-pick").forEach((el) => {
            if (el.checked) picked.push(String(parseInt(el.dataset.oi, 10) + 1));
          });
          q.answer = picked.join(",");
          renderEditor();
        });
      });
      card.querySelectorAll(".opt-text").forEach((inp) => {
        inp.addEventListener("change", () => {
          q.options[parseInt(inp.dataset.oi, 10)] = inp.value;
          renderEditor();
        });
      });
      card.querySelectorAll(".opt-del").forEach((btn) => {
        btn.addEventListener("click", () => {
          const oi = parseInt(btn.dataset.oi, 10);
          q.options.splice(oi, 1);
          const picks = (q.answer || "").split(",").map((s) => parseInt(s, 10)).filter((n) => !isNaN(n));
          q.answer = picks.filter((n) => n !== oi + 1).map((n) => (n > oi + 1 ? n - 1 : n)).join(",");
          renderEditor();
        });
      });
      const addOptBtn = card.querySelector(".opt-add");
      if (addOptBtn) {
        addOptBtn.addEventListener("click", () => {
          if (q.options.length >= 20) return showToast("最多支援 20 個選項");
          q.options.push("");
          renderEditor();
        });
      }

      const fCase = card.querySelector(".f-case");
      if (fCase) fCase.addEventListener("change", (e) => { q.fillCaseFlag = e.target.value; renderEditor(); });
      const fOrder = card.querySelector(".f-order");
      if (fOrder) fOrder.addEventListener("change", (e) => { q.fillOrderFlag = e.target.value; renderEditor(); });
      const fEssay = card.querySelector(".f-essay-ans");
      if (fEssay) fEssay.addEventListener("change", (e) => { q.answer = e.target.value; renderEditor(); });

      card.querySelector(".q-up").addEventListener("click", () => {
        if (idx > 0) {
          [state.questions[idx - 1], state.questions[idx]] = [state.questions[idx], state.questions[idx - 1]];
          renderEditor();
        }
      });
      card.querySelector(".q-down").addEventListener("click", () => {
        if (idx < state.questions.length - 1) {
          [state.questions[idx + 1], state.questions[idx]] = [state.questions[idx], state.questions[idx + 1]];
          renderEditor();
        }
      });
      card.querySelector(".q-del").addEventListener("click", () => {
        state.questions.splice(idx, 1);
        renderEditor();
      });

      list.appendChild(card);
    });

    if (shown === 0) {
      list.innerHTML = `<div class="alert">目前篩選或搜尋條件下沒有符合的題目，請切換回「全部題目」或清除關鍵字。</div>`;
    }
  }

  function updateExportButtonsState() {
    const validation = QB.validateAll(state.questions);
    const allowInvalid = $("chk-allow-invalid").checked;
    const canExport = state.questions.length > 0 && (validation.invalidCount === 0 || allowInvalid);

    $("btn-export-utf8").disabled = !canExport;
    $("btn-export-utf8-bom").disabled = !canExport;
    $("btn-export-big5").disabled = !canExport;
    $("btn-export-gift").disabled = !canExport;
    $("btn-export-json").disabled = state.questions.length === 0;
    $("btn-copy-csv").disabled = !canExport;
    $("btn-preview-csv").disabled = state.questions.length === 0;

    const warnBox = $("big5-warning-box");
    if (state.questions.length > 0) {
      const csv = QB.buildCsvUtf8(state.questions);
      const b5 = QB.encodeCp950(csv);
      if (b5.unmappable.length > 0) {
        warnBox.className = "alert alert-warn";
        warnBox.innerHTML =
          `<strong>⚠ Big5 (CP950) 字元提醒：</strong>以下字元不在 Big5 字集內，匯出 Big5 版時會變為 <code>?</code>，建議改用 UTF-8 版或先改寫字元：<br><code>${escapeHtml(b5.unmappable.join("、"))}</code>`;
        warnBox.hidden = false;
      } else if (b5.remappedCount > 0) {
        warnBox.className = "alert alert-ok";
        warnBox.textContent = `✓ Big5 (CP950) 相容檢查通過（已自動將 ${b5.remappedCount} 處 ≥/≤/・ 轉為 Big5 等義符號）。`;
        warnBox.hidden = false;
      } else {
        warnBox.hidden = true;
      }
    } else {
      warnBox.hidden = true;
    }
  }

  function exportQuestions(format) {
    const stem = baseFileName(state.sourceFileName);
    if (format === "utf8") {
      const csv = QB.buildCsvUtf8(state.questions, { withBom: false });
      const bytes = new TextEncoder().encode(csv);
      triggerDownload(new Blob([bytes], { type: "text/csv;charset=utf-8" }), `${stem}.csv`);
      showToast(`已下載 ${stem}.csv（ee-Class UTF-8 無 BOM，${bytes.length} bytes）`);
    } else if (format === "utf8-bom") {
      const csv = QB.buildCsvUtf8(state.questions, { withBom: true });
      const bytes = new TextEncoder().encode(csv);
      triggerDownload(new Blob([bytes], { type: "text/csv;charset=utf-8" }), `${stem}_UTF8_BOM.csv`);
      showToast(`已下載 ${stem}_UTF8_BOM.csv（Excel 友善 UTF-8 BOM）`);
    } else if (format === "big5") {
      const csv = QB.buildCsvUtf8(state.questions, { withBom: false });
      const res = QB.encodeCp950(csv);
      triggerDownload(new Blob([res.bytes], { type: "text/csv;charset=big5" }), `${stem}_big5.csv`);
      showToast(
        res.unmappable.length > 0
          ? `已下載 ${stem}_big5.csv（注意：有 ${res.unmappable.length} 種字元轉成 ?）`
          : `已下載 ${stem}_big5.csv（Big5/CP950 無損，${res.bytes.length} bytes）`
      );
    } else if (format === "gift") {
      const gift = QB.buildGift(state.questions, $("default-category").value.trim());
      triggerDownload(new Blob([gift], { type: "text/plain;charset=utf-8" }), `${stem}.gift`);
      showToast(`已下載 ${stem}.gift（ee-Class / Moodle GIFT 格式）`);
    } else if (format === "json") {
      const json = QB.buildJsonBackup(state.questions, $("default-category").value.trim());
      triggerDownload(new Blob([json], { type: "application/json;charset=utf-8" }), `${stem}_backup.json`);
      showToast(`已備份 ${stem}_backup.json（下次直接拖入即可還原續編）`);
    }
  }

  // ===== Tab 3：CSV 驗收與 Big5 / GIFT 轉碼 =====
  function initValidator() {
    const dz = $("csv-drop-zone");
    const fi = $("csv-file-input");

    dz.addEventListener("click", () => fi.click());
    dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("dragover"); });
    dz.addEventListener("dragleave", () => dz.classList.remove("dragover"));
    dz.addEventListener("drop", (e) => {
      e.preventDefault();
      dz.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files[0]) loadCsvFileForValidation(e.dataTransfer.files[0]);
    });
    fi.addEventListener("change", () => {
      if (fi.files && fi.files[0]) loadCsvFileForValidation(fi.files[0]);
      fi.value = "";
    });

    $("btn-validate-csv").addEventListener("click", runCsvValidation);
    $("btn-validator-clear").addEventListener("click", () => {
      $("csv-paste-input").value = "";
      $("validator-result").hidden = true;
      state.validatorQuestions = [];
    });

    $("btn-validator-load-editor").addEventListener("click", () => {
      if (state.validatorQuestions.length === 0) return;
      state.questions = state.validatorQuestions.map((q) => Object.assign({}, q, { options: [...q.options] }));
      state.sourceFileName = state.validatorFileName;
      state.lastNormSummary = `由「CSV 驗收器」載入 ${state.questions.length} 題進行修正。`;
      renderEditor();
      switchMainTab("editor");
      showToast(`已載入 ${state.questions.length} 題到編輯器`);
    });

    $("btn-validator-export-utf8").addEventListener("click", () => {
      const csv = QB.buildCsvUtf8(state.validatorQuestions, { withBom: false });
      const bytes = new TextEncoder().encode(csv);
      triggerDownload(new Blob([bytes], { type: "text/csv;charset=utf-8" }), `${state.validatorFileName}_fixed.csv`);
      showToast("已下載重整後的 UTF-8（無 BOM）CSV");
    });

    $("btn-validator-export-big5").addEventListener("click", () => {
      const csv = QB.buildCsvUtf8(state.validatorQuestions, { withBom: false });
      const res = QB.encodeCp950(csv);
      triggerDownload(new Blob([res.bytes], { type: "text/csv;charset=big5" }), `${state.validatorFileName}_big5.csv`);
      showToast(res.unmappable.length ? `已下載 Big5 版（${res.unmappable.length} 種字元轉成 ?）` : "已下載 Big5 (CP950) 無損版 CSV");
    });

    $("btn-validator-export-gift").addEventListener("click", () => {
      const gift = QB.buildGift(state.validatorQuestions, "");
      triggerDownload(new Blob([gift], { type: "text/plain;charset=utf-8" }), `${state.validatorFileName}.gift`);
      showToast("已下載 GIFT 格式 (.gift)");
    });
  }

  async function loadCsvFileForValidation(file) {
    state.validatorFileName = baseFileName(file.name);
    const buf = await file.arrayBuffer();
    const { text, encoding } = QB.decodeFileBytesSmart(buf);
    $("csv-paste-input").value = text;
    showToast(`已載入 ${file.name}（偵測編碼：${encoding}）`);
    runCsvValidation();
  }

  function runCsvValidation() {
    const raw = $("csv-paste-input").value;
    if (!raw.trim()) return showToast("請先上傳或貼上 CSV 內容");

    const res = QB.inspectQbCsv(raw);
    state.validatorQuestions = res.questions;
    $("validator-result").hidden = false;

    const sumEl = $("validator-summary");
    if (res.ok) {
      sumEl.className = "alert alert-ok";
      sumEl.innerHTML = `<strong>✓ 驗收通過！</strong>表頭為 <code>version: 4</code>，全部 ${res.questions.length} 題皆符合 ee-Class 27 欄格式規範，可直接匯入或轉存 Big5 / GIFT。`;
    } else {
      sumEl.className = "alert alert-error";
      sumEl.innerHTML = `<strong>✕ 發現格式或題目問題：</strong>結構錯誤 ${res.structuralErrors.length} 項、題目錯誤 ${res.validation.invalidCount} 題。建議點下方「載入到編輯器修正」。`;
    }

    const issues = [];
    res.structuralErrors.forEach((m) => issues.push(`<div class="q-issue err">✕ [檔案結構] ${escapeHtml(m)}</div>`));
    res.structuralWarnings.forEach((m) => issues.push(`<div class="q-issue warn">⚠ [檔案結構] ${escapeHtml(m)}</div>`));
    res.validation.perQuestion.forEach((v, i) => {
      v.errors.forEach((m) => issues.push(`<div class="q-issue err">✕ [第 ${i + 1} 題] ${escapeHtml(m)}</div>`));
      v.warnings.forEach((m) => issues.push(`<div class="q-issue warn">⚠ [第 ${i + 1} 題] ${escapeHtml(m)}</div>`));
    });

    if (res.questions.length > 0) {
      const rebuilt = QB.buildCsvUtf8(res.questions, { withBom: false });
      const b5 = QB.encodeCp950(rebuilt);
      if (b5.unmappable.length > 0) {
        issues.push(`<div class="q-issue warn">⚠ [Big5 檢查] 以下字元無法轉成 Big5（會變 ?）：<code>${escapeHtml(b5.unmappable.join("、"))}</code></div>`);
      } else {
        issues.push(`<div class="q-issue ok">✓ [Big5 檢查] 全部字元皆可無損轉為 Big5 (CP950)。</div>`);
      }
    }

    $("validator-issues").innerHTML = issues.join("");
    const hasQ = res.questions.length > 0;
    $("btn-validator-load-editor").disabled = !hasQ;
    $("btn-validator-export-utf8").disabled = !hasQ;
    $("btn-validator-export-big5").disabled = !hasQ;
    $("btn-validator-export-gift").disabled = !hasQ;
  }

  // ===== Tab 4：講義 / PDF 轉 5 大題型出題助手 =====
  function getLectureCounts() {
    const num = (id) => Math.max(0, Math.min(50, parseInt($(id).value, 10) || 0));
    return {
      tf: num("lec-cnt-tf"),
      single: num("lec-cnt-single"),
      multi: num("lec-cnt-multi"),
      fill: num("lec-cnt-fill"),
      essay: num("lec-cnt-essay"),
    };
  }

  function buildLecturePromptText(includeFullLecture) {
    const cat = $("lecture-category").value.trim();
    const c = getLectureCounts();
    const parts = [];
    if (c.tf > 0) parts.push(`- 一、是非題 ${c.tf} 題（答案寫「答案：O」或「答案：X」）`);
    if (c.single > 0) parts.push(`- 二、單選題 ${c.single} 題（每題 4 個選項 (A)(B)(C)(D)，標註「答案：A」）`);
    if (c.multi > 0) parts.push(`- 三、複選題 ${c.multi} 題（每題 4 個選項 (A)(B)(C)(D)，標註「答案：(A)(C)」）`);
    if (c.fill > 0) parts.push(`- 四、填充題 ${c.fill} 題（題幹空格處直接寫為 [*標準答案*]，例：地球約有[*70%*]為海洋）`);
    if (c.essay > 0) parts.push(`- 五、問答題 ${c.essay} 題（以「參考答案：」列出評分要點）`);

    const header = [
      "請將以下【課程講義 / 教材內容】轉化為 ee-Class 題庫標準格式：",
      cat ? `類別：${cat}` : "1. 頂部請依講義主題標註「類別：章節或主題名稱」。",
      "",
      "指定題型與數量：",
      ...(parts.length ? parts : ["- 請依講義重點產出是非、單選、複選、填充與問答題"]),
      "",
      "每題皆須附上「解說：」與「難易度：容易/適中/困難」，確保命題嚴格依據講義內容。",
      "",
      "【課程講義內容】：",
    ].join("\n");

    const wantAttach = $("lec-include-text").checked;
    if (state.lectureIsScanned) {
      return header + `\n（已選取掃描型 PDF：${state.lectureFileName}，請直接將此 PDF 當作附件上傳給 AI，或點下方「✨ 直接用 Gemini AI 依此講義出題」）`;
    }
    if (!state.lectureText) {
      return header + "\n（請先在上方拖入 PDF / Word / 文字講義，或在此自行貼上講義內容）";
    }
    if (!wantAttach) {
      return header + `\n（已載入講義：${state.lectureFileName}，共 ${state.lectureText.length} 字；未勾選附帶全文，請自行將 PDF 當作附件上傳）`;
    }
    if (includeFullLecture) {
      return header + "\n" + state.lectureText;
    }
    // 預覽區精簡顯示前 320 字避免畫面過長，實際複製時會附上完整全文
    const previewBody =
      state.lectureText.length > 320
        ? state.lectureText.slice(0, 320) + `\n...（已載入完整講義 ${state.lectureText.length} 字，點擊「📋 一鍵複製完整出題提示詞」時會完整附帶全文）`
        : state.lectureText;
    return header + "\n" + previewBody;
  }

  function refreshLecturePromptPreview() {
    $("prompt-tpl-1").textContent = buildLecturePromptText(false);
  }

  function initLectureGenerator() {
    const dz = $("lecture-drop-zone");
    const fi = $("lecture-file-input");

    dz.addEventListener("click", () => fi.click());
    dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("dragover"); });
    dz.addEventListener("dragleave", () => dz.classList.remove("dragover"));
    dz.addEventListener("drop", (e) => {
      e.preventDefault();
      dz.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files[0]) handleLectureFile(e.dataTransfer.files[0]);
    });
    fi.addEventListener("change", () => {
      if (fi.files && fi.files[0]) handleLectureFile(fi.files[0]);
      fi.value = "";
    });

    ["lecture-category", "lec-cnt-tf", "lec-cnt-single", "lec-cnt-multi", "lec-cnt-fill", "lec-cnt-essay", "lec-include-text"].forEach((id) => {
      $(id).addEventListener("input", refreshLecturePromptPreview);
      $(id).addEventListener("change", refreshLecturePromptPreview);
    });

    $("btn-lecture-clear").addEventListener("click", () => {
      state.lectureText = "";
      state.lectureFileName = "";
      state.lecturePdfBase64 = null;
      state.lectureMimeType = "";
      state.lectureIsScanned = false;
      $("lecture-file-status").hidden = true;
      $("lecture-gen-banner").hidden = true;
      refreshLecturePromptPreview();
      showToast("已清空匯入的講義");
    });

    $("btn-copy-lecture-prompt").addEventListener("click", () => {
      const fullPrompt = buildLecturePromptText(true);
      copyText(fullPrompt, state.lectureText && $("lec-include-text").checked ? `已複製完整出題提示詞（含講義 ${state.lectureText.length} 字）` : "已複製出題提示詞！");
    });

    $("btn-ai-gen-from-lecture").addEventListener("click", runAiGenerateFromLecture);
    refreshLecturePromptPreview();
  }

  async function handleLectureFile(file) {
    const name = file.name || "lecture";
    const ext = name.toLowerCase().split(".").pop();
    const statusEl = $("lecture-file-status");
    statusEl.hidden = false;

    state.lectureText = "";
    state.lectureFileName = name;
    state.lecturePdfBase64 = null;
    state.lectureMimeType = "";
    state.lectureIsScanned = false;

    if (ext === "doc") {
      statusEl.className = "alert alert-error";
      statusEl.textContent = "不支援舊版 Word (.doc)，請先另存為 .pdf 或 .docx 再匯入。";
      refreshLecturePromptPreview();
      return;
    }

    if (ext === "pdf") {
      try {
        statusEl.className = "alert";
        statusEl.textContent = `⏳ 正在離線抽取 PDF 講義文字：${name}...`;
        const buf = await file.arrayBuffer();
        state.lecturePdfBase64 = arrayBufferToBase64(buf);
        state.lectureMimeType = "application/pdf";

        const pdfRes = await QB.extractPdfText(buf.slice(0));
        if (!pdfRes.isLikelyScanned) {
          state.lectureText = pdfRes.text;
          state.lectureIsScanned = false;
          if (!$("lecture-category").value.trim()) {
            $("lecture-category").value = baseFileName(name);
          }
          statusEl.className = "alert alert-ok";
          statusEl.textContent = `✓ 已離線抽取 PDF 講義：${name}（共 ${pdfRes.pageCount} 頁、${pdfRes.text.length} 字）。可直接點「📋 一鍵複製完整出題提示詞」貼給網頁版 AI，或點「✨ 直接用 Gemini AI 依此講義出題」！`;
        } else {
          state.lectureIsScanned = true;
          if (!$("lecture-category").value.trim()) {
            $("lecture-category").value = baseFileName(name);
          }
          statusEl.className = "alert alert-warn";
          statusEl.textContent = `偵測到「${name}」（共 ${pdfRes.pageCount} 頁）為掃描圖片型 PDF（無內嵌文字層）。建議點「✨ 直接用 Gemini AI 依此講義出題」（直接讀取原檔圖文），或複製下方提示詞並將 PDF 當附件上傳給網頁版 AI。`;
        }
      } catch (err) {
        statusEl.className = "alert alert-error";
        statusEl.textContent = `讀取 PDF 講義失敗：${err.message}`;
      }
      refreshLecturePromptPreview();
      return;
    }

    if (ext === "docx") {
      try {
        const buf = await file.arrayBuffer();
        const text = await QB.extractDocxText(buf);
        state.lectureText = text;
        if (!$("lecture-category").value.trim()) $("lecture-category").value = baseFileName(name);
        statusEl.className = "alert alert-ok";
        statusEl.textContent = `✓ 已離線抽取 Word 講義：${name}（共 ${text.length} 字）。`;
      } catch (err) {
        statusEl.className = "alert alert-error";
        statusEl.textContent = `讀取 Word 講義失敗：${err.message}`;
      }
      refreshLecturePromptPreview();
      return;
    }

    if (["txt", "md"].includes(ext)) {
      const buf = await file.arrayBuffer();
      const { text, encoding } = QB.decodeFileBytesSmart(buf);
      state.lectureText = text;
      if (!$("lecture-category").value.trim()) $("lecture-category").value = baseFileName(name);
      statusEl.className = "alert alert-ok";
      statusEl.textContent = `✓ 已讀取文字講義：${name}（編碼：${encoding}，共 ${text.length} 字）。`;
      refreshLecturePromptPreview();
      return;
    }

    statusEl.className = "alert alert-warn";
    statusEl.textContent = `不支援的講義格式 (.${ext})，請上傳 .pdf、.docx、.txt 或 .md。`;
    refreshLecturePromptPreview();
  }

  async function runAiGenerateFromLecture() {
    const banner = $("lecture-gen-banner");
    if (!state.lectureText && !state.lecturePdfBase64) {
      banner.className = "alert alert-warn";
      banner.textContent = "請先在上方拖入 PDF / Word / 文字講義檔案。";
      banner.hidden = false;
      return;
    }

    const apiKey = $("gemini-api-key").value.trim();
    const modelSel = $("gemini-model").value;
    const model = modelSel === "__custom__" ? $("gemini-custom-model").value.trim() : modelSel;
    const category = $("lecture-category").value.trim();
    const counts = getLectureCounts();

    const btn = $("btn-ai-gen-from-lecture");
    const origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "⏳ Gemini AI 依講義命題中...";
    banner.className = "alert alert-purple";
    banner.textContent = `正在呼叫 Gemini (${model}) 依據「${state.lectureFileName}」出題，請稍候...`;
    banner.hidden = false;

    try {
      const res = await QB.callGeminiLectureGenerator({
        apiKey,
        model,
        lectureText: state.lectureText,
        pdfBase64: state.lecturePdfBase64,
        mimeType: state.lectureMimeType,
        fileName: state.lectureFileName,
        category,
        counts,
      });
      state.questions = res.questions;
      state.sourceFileName = baseFileName(state.lectureFileName || "lecture_quiz");
      if (category) $("default-category").value = category;
      state.lastNormSummary = `由 Gemini AI 依據講義「${state.lectureFileName}」自動產出 ${res.questions.length} 題（5 大題型）。${res.notes ? " " + res.notes : ""}`;
      banner.className = "alert alert-ok";
      banner.textContent = state.lastNormSummary;
      state.activeFilter = "all";
      state.searchKeyword = "";
      renderEditor();
      switchMainTab("editor");
      showToast(`已依講義產出 ${res.questions.length} 題，進入編輯器校對！`);
    } catch (err) {
      banner.className = "alert alert-error";
      banner.textContent = err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = origText;
    }
  }

  // ===== Tab 4 & 5：提示詞助手、教學與安裝進度 =====
  function initPromptsAndGuide() {
    document.querySelectorAll(".subtab").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.guideTab;
        document.querySelectorAll(".subtab").forEach((b) => {
          b.setAttribute("aria-selected", b === btn ? "true" : "false");
        });
        document.querySelectorAll(".guide-subpanel").forEach((p) => {
          p.hidden = p.id !== `guide-${target}`;
        });
      });
    });

    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.checklist) || "{}"); } catch (_) {}
    const checks = Array.from(document.querySelectorAll(".guide-check"));
    checks.forEach((chk) => {
      if (saved[chk.dataset.step]) chk.checked = true;
      chk.addEventListener("change", () => {
        saved[chk.dataset.step] = chk.checked;
        localStorage.setItem(STORAGE_KEYS.checklist, JSON.stringify(saved));
        updateChecklistProgress(checks);
      });
    });
    updateChecklistProgress(checks);

    $("btn-reset-checklist").addEventListener("click", () => {
      checks.forEach((c) => (c.checked = false));
      saved = {};
      localStorage.removeItem(STORAGE_KEYS.checklist);
      updateChecklistProgress(checks);
      showToast("已重設安裝進度");
    });

    function updatePrompt() {
      const cat = $("prompt-category").value.trim();
      const byChapter = $("prompt-by-chapter").checked;
      let text;
      if (byChapter) text = "請把附件轉成題庫 CSV，類別用各章節標題";
      else if (cat) text = `請把附件轉成題庫 CSV，類別：${cat}`;
      else text = "請把附件轉成題庫 CSV";
      $("prompt-output").textContent = text;
    }

    $("prompt-category").addEventListener("input", updatePrompt);
    $("prompt-by-chapter").addEventListener("change", updatePrompt);
    updatePrompt();

    $("btn-copy-prompt").addEventListener("click", () => {
      copyText($("prompt-output").textContent, "已複製 Gemini 指令！");
    });

    document.querySelectorAll("[data-copy-target]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const el = $(btn.dataset.copyTarget);
        if (el) copyText(el.textContent.trim(), "已複製範本內容！");
      });
    });
  }

  function updateChecklistProgress(checks) {
    const done = checks.filter((c) => c.checked).length;
    const pct = checks.length ? Math.round((done / checks.length) * 100) : 0;
    $("guide-progress-bar").style.width = `${pct}%`;
    $("guide-progress-text").textContent = `Gemini 技能安裝進度：${done} / ${checks.length} 步（${pct}%）`;
  }

  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initTabs();
    initConverter();
    initEditorControls();
    initValidator();
    initLectureGenerator();
    initPromptsAndGuide();
  });
})();
