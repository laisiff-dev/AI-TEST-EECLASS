/**
 * ee-Class 智慧題目轉換系統 - 主程式邏輯 (App Controller) - Pro 2026
 * 整合 Tools_QB 架構：
 * 1. 支援 Word (.docx)、Markdown (.md)、純文字 (.txt) 檔案拖曳與即時抽取
 * 2. 支援 5 大題型視覺化編輯：是非、單選、複選、填充、問答
 * 3. 支援題庫「類別 (Category)」全域設定與個別調整
 * 4. 支援 UTF-8 BOM CSV、Big5 副本 CSV (CP950) 與 GIFT 匯出
 * 5. 嚴格防呆檢核與診斷對照
 */

document.addEventListener('DOMContentLoaded', () => {
  // 核心狀態
  let state = {
    questions: [],
    activeTab: 'parser',
    currentFilter: 'all',
    searchQuery: '',
    globalCategory: '',
    fontSize: localStorage.getItem('eeclass_font_size') || 'md',
    theme: localStorage.getItem('eeclass_theme') || 'dark'
  };

  // SDGs 自由格式真實考卷範例（非標準排版，示範二段式智慧調整）
  const SAMPLE_SDGS_FREEFORM_TEXT = `國立大學 112學年度 通識教育核心課程：永續發展目標 (SDGs) 期末核心素養測驗
考試時間：50分鐘   姓名：_____________   學號：_____________
※ 作答說明：請仔細閱讀題目後作答，題目包含是非題、單選題、複選題、填空題與簡答題。

【一、是非判斷題】
( O ) 1. 聯合國於2015年9月正式通過「2030永續發展議程」，宣布了17項永續發展目標（SDGs）。
( X ) 2. SDGs 僅適用於低收入或開發中國家，台灣與歐美等已開發國家無須落實執行。
3. SDGs 的核心不遺漏精神為「Leave No One Behind」（不遺漏任何人）。 (對)
4. ( 2 ) SDG 13「氣候行動」僅指減少碳排放，不包含氣候變遷的調適與韌性建構。
【說明】氣候行動包含減緩（Mitigation）與調適（Adaptation）兩大面向。

【二、單選測驗題】
( C ) 1. 聯合國宣布的永續發展目標（SDGs）共包含幾項核心目標與具體目標？
(A) 15項核心目標、150項具體目標  (B) 16項核心目標、160項具體目標  (C) 17項核心目標、169項具體目標  (D) 18項核心目標、172項具體目標
【解析】SDGs共有17項核心目標 (Goals) 與169項具體目標 (Targets)。

2. 請問「確保所有人都能享有水及衛生及其永續管理」是屬於哪一項SDG？
A. SDG 4 優質教育
B. SDG 6 淨水及衛生
C. SDG 7 可負擔的潔淨能源
D. SDG 11 永續城鄉
Ans: B

3. 關於永續發展的三大支柱（Three Pillars of Sustainability），下列何者「不屬於」其中之一？
(1) 經濟成長  (2) 社會包容  (3) 環境保護  (4) 軍事擴張
正解：4
說明：三大支柱為經濟（Economic）、社會（Social）、環境（Environmental）。

【三、多重選擇題】
1. 下列哪些目標直接與地球自然環境與生態保育密切相關？
(A) SDG 13 氣候行動
(B) SDG 14 保育海洋生態
(C) SDG 15 保育陸域生態
(D) SDG 10 減少不平等
答案：A, B, C
解析：SDG 13、14、15合稱為生物圈（Biosphere）層級的環境目標；SDG 10為社會層級。

2. 企業在推動 ESG 與 SDGs 結合時，常見的「E (Environmental)」環境構面指標包含哪些？
(A) 溫室氣體盤查與減碳 (B) 水資源管理與循環利用 (C) 董事會多元化 (D) 廢棄物減量與資源再生
【答案】A、B、D
【詳解】(C) 董事會多元化屬於 G（Governance 公司治理）範疇。

【四、填空題】
1. 聯合國 SDGs 的最高核心承諾為__________(不遺漏任何人)（英文為 Leave No One Behind）。
2. 在永續發展目標中，SDG 7 主張確保所有人都能取得負擔得起、可靠且永續的【潔淨能源】。

【五、簡答題】
1. 請簡述聯合國提出「SDGs 永續發展目標」的核心目的為何？
答案：旨在消除貧窮、保護地球環境、促進全球夥伴關係，確保至2030年所有人都能享有和平與繁榮。`;

  // 預設 5 大題型全功能範例題庫
  const SAMPLE_AI_TEXT = `# 第一章 環境微生物學基礎與應用
類別：環境微生物學基礎

一、是非題
1. 細菌（Bacteria）與古菌（Archaea）皆屬原核生物，但在細胞膜脂質與細胞壁組成上存在重要差異。
答案：O
解析：兩者都沒有真正細胞核，但古菌常具有醚鍵脂質，且細胞壁不具典型細菌式肽聚糖。
難易度：適中

2. 藍綠菌（Cyanobacteria）屬於真核藻類，因此具有真正細胞核。
答案：X
解析：藍綠菌屬細菌域，為原核生物，不具有真正細胞核。
難易度：容易

二、單選題
1. 下列何者最能區分原核細胞與真核細胞？
(A) 是否具有真正由核膜包覆的細胞核
(B) 是否能進行能量代謝
(C) 是否含有DNA
(D) 是否可存在於水環境中
答案：A
解析：原核細胞沒有真正由核膜包覆的細胞核；真核細胞則有。
難易度：適中

2. 在解析度公式 d≈0.61λ/NA 中，若其他條件相同，數值孔徑（NA）增加時 d 會：
(A) 增加
(B) 減少
(C) 不變
(D) 先增加再減少
答案：B
解析：d 越小代表可分辨更接近的兩點，因此解析度更好。
難易度：適中

三、複選題
[類別：生物脫氮與溫室氣體]
1. 關於廢水生物脫氮與溫室氣體生成，下列哪些敘述正確？
(A) 硝化作用是由氨氧化菌與亞硝酸氧化菌共同完成
(B) 脫氮作用（反硝化）主要在好氧條件下進行
(C) 溶氧不足或亞硝酸鹽累積容易導致 N2O 溫室氣體釋放
(D) 反硝化菌通常需要碳源作為電子提供者
答案：(A)(C)(D)
解析：脫氮作用（反硝化）是在缺氧/無氧條件下進行，因此 (B) 錯誤；其餘皆正確。
難易度：困難

2. 近年來在環境流行病學中，曾引發全球跨國監測之新型呼吸道病原體包含：
(A) H1N1新型流感病毒
(B) SARS-CoV-2 新冠病毒
(C) 枯草芽孢桿菌
(D) MERS-CoV 中東呼吸道症候群冠狀病毒
答案：A, B, D
解析：枯草芽孢桿菌（Bacillus subtilis）為常見土壤益菌，並非跨國流行呼吸道病原體。
難易度：適中

四、填充題
[類別：環境法規與指標參數]
1. H1N1新型流感自民國[*98*]年[*6*]月[*19*]日自第一類法定傳染病刪除。
答案：98, 6, 19
解析：請牢記疾病管制署公佈之法定傳染病分類調整日期。
難易度：適中

2. 大氣中造成全球暖化效應最劇烈的三大主要溫室氣體分別為二氧化碳（CO2）、[*甲烷*]（CH4）與[*氧化亞氮*]（N2O）。
答案：甲烷, 氧化亞氮
解析：依據 IPCC 評估報告，CH4 與 N2O 增溫潛勢遠高於 CO2。
難易度：容易

五、問答題
[類別：緊急應變與實驗室安全]
1. 請簡述燒燙傷急救處理五步驟「沖、脫、泡、蓋、送」之標準操作要領。
答案：1. 沖：以流動冷水沖洗傷口15~30分鐘降溫。2. 脫：在水中小心剪開或脫去衣物。3. 泡：持續在冷水中浸泡傷口。4. 蓋：使用乾淨無菌紗布覆蓋。5. 送：儘速送醫治療。
解析：正確冷水降溫與保護創面可大幅降低組織熱傷害與後續感染風險。
難易度：適中
`;

  // DOM 元素快取
  const dom = {
    // 統計指標
    statTotal: document.getElementById('stat-total'),
    statTf: document.getElementById('stat-tf'),
    statSingle: document.getElementById('stat-single'),
    statMulti: document.getElementById('stat-multi'),
    statFill: document.getElementById('stat-fill'),
    statEssay: document.getElementById('stat-essay'),
    statWarning: document.getElementById('stat-warning'),
    tabBadgeCount: document.getElementById('tab-badge-count'),

    // 頁籤按鈕與容器
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),

    // 檔案拖曳與輸入區
    dropzone: document.getElementById('upload-dropzone'),
    fileUploader: document.getElementById('file-uploader'),
    rawInput: document.getElementById('raw-quiz-input'),
    charCount: document.getElementById('input-char-count'),
    btnParse: document.getElementById('btn-parse-text'),
    btnAutoNormalize: document.getElementById('btn-auto-normalize'),
    btnLoadSdgsSample: document.getElementById('btn-load-sdgs-sample'),
    btnLoadSample: document.getElementById('btn-load-sample'),
    btnClearInput: document.getElementById('btn-clear-input'),
    btnGotoManual: document.getElementById('btn-goto-manual'),
    btnGuideToManual: document.getElementById('btn-guide-to-manual'),

    // 全域類別
    globalCategoryInput: document.getElementById('global-category-input'),
    btnApplyGlobalCat: document.getElementById('btn-apply-global-cat'),

    // 編輯器區
    stage2WorkflowBanner: document.getElementById('stage2-workflow-banner'),
    stage2NormBadge: document.getElementById('stage2-norm-badge'),
    stage2NormCount: document.getElementById('stage2-norm-count'),
    stage2BannerDesc: document.getElementById('stage2-banner-desc'),
    btnFilterAutoNormalized: document.getElementById('btn-filter-auto-normalized'),
    normFilterBadgeCount: document.getElementById('norm-filter-badge-count'),
    pillFilterNormalized: document.getElementById('pill-filter-normalized'),
    questionsList: document.getElementById('questions-container'),
    emptyState: document.getElementById('empty-state'),
    filterBtns: document.querySelectorAll('.filter-pill'),
    searchInput: document.getElementById('search-questions-input'),
    btnAddQuestion: document.getElementById('btn-add-question'),
    btnClearQuestions: document.getElementById('btn-clear-questions'),
    fontSizeBtns: document.querySelectorAll('.btn-font-size'),

    // 匯出按鈕
    btnExportCsv: document.getElementById('btn-export-csv'),
    btnExportBig5: document.getElementById('btn-export-big5'),
    btnExportGift: document.getElementById('btn-export-gift'),
    btnThemeToggle: document.getElementById('btn-theme-toggle'),

    // 檢核防呆診斷彈出視窗
    diagModal: document.getElementById('diagnostics-modal'),
    modalIssuesList: document.getElementById('modal-issues-list'),
    modalErrCount: document.getElementById('modal-err-count'),
    modalWarnCount: document.getElementById('modal-warn-count'),
    modalBtnGoEditor: document.getElementById('modal-btn-go-editor'),
    modalBtnManual: document.getElementById('modal-btn-manual'),
    modalBtnDismiss: document.getElementById('modal-btn-dismiss'),

    // Toast
    toastContainer: document.getElementById('toast-container')
  };

  /**
   * 初始化
   */
  function init() {
    applyTheme(state.theme);
    applyFontSize(state.fontSize);
    bindEvents();
    loadFromLocalStorage();
    updateStats();
    updateStage2WorkflowBanner();
    updateCharCount();
  }

  /**
   * 套用題目顯示字型大小
   */
  function applyFontSize(size) {
    state.fontSize = size;
    localStorage.setItem('eeclass_font_size', size);
    if (dom.questionsList) {
      dom.questionsList.classList.remove('font-size-sm', 'font-size-md', 'font-size-lg', 'font-size-xl');
      dom.questionsList.classList.add(`font-size-${size}`);
    }
    if (dom.fontSizeBtns) {
      dom.fontSizeBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.size === size);
      });
    }
  }

  /**
   * 套用主題色彩
   */
  function applyTheme(theme) {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('eeclass_theme', theme);
  }

  /**
   * 繫結所有使用者互動事件
   */
  function bindEvents() {
    // 主題切換
    if (dom.btnThemeToggle) {
      dom.btnThemeToggle.addEventListener('click', () => {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        applyTheme(state.theme);
        showToast(state.theme === 'dark' ? '已切換為深邃暗黑模式' : '已切換為簡約明亮模式', 'info');
      });
    }

    // 頁籤切換
    dom.tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        switchTab(target);
      });
    });

    // 快捷跳轉手冊
    if (dom.btnGotoManual) dom.btnGotoManual.addEventListener('click', () => switchTab('manual'));
    if (dom.btnGuideToManual) dom.btnGuideToManual.addEventListener('click', () => switchTab('manual'));

    // 檔案拖曳與上傳處理 (Tools_QB 核心邏輯)
    if (dom.dropzone && dom.fileUploader) {
      dom.dropzone.addEventListener('click', () => dom.fileUploader.click());

      dom.fileUploader.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          handleUploadedFile(e.target.files[0]);
        }
      });

      dom.dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dom.dropzone.classList.add('drag-active');
      });
      dom.dropzone.addEventListener('dragleave', () => {
        dom.dropzone.classList.remove('drag-active');
      });
      dom.dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dom.dropzone.classList.remove('drag-active');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleUploadedFile(e.dataTransfer.files[0]);
        }
      });
    }

    // 全域類別套用按鈕
    if (dom.btnApplyGlobalCat && dom.globalCategoryInput) {
      dom.btnApplyGlobalCat.addEventListener('click', () => {
        const cat = dom.globalCategoryInput.value.trim();
        state.globalCategory = cat;
        if (state.questions.length > 0) {
          state.questions.forEach(q => {
            q.category = cat;
          });
          renderQuestionsList();
          saveToLocalStorage();
          showToast(`已將全域類別「${cat || '（無類別）'}」套用到全部 ${state.questions.length} 道題目！`, 'success');
        } else {
          showToast('目前尚無題目，解析題目後將自動套用此類別', 'info');
        }
      });
    }

    // 輸入區即時字數統計
    if (dom.rawInput) {
      dom.rawInput.addEventListener('input', () => {
        updateCharCount();
      });
    }

    // 自由格式智慧重構 (Auto-Normalize - 第一階段)
    if (dom.btnAutoNormalize) {
      dom.btnAutoNormalize.addEventListener('click', () => {
        const text = dom.rawInput.value.trim();
        if (!text) {
          showToast('請先貼上題目內容或拖曳考題檔！', 'warning');
          return;
        }
        const norm = QuizParser.normalizeFreeformQuizText(text);
        dom.rawInput.value = norm.normalizedText;
        updateCharCount();
        if (norm.detectedCategory && dom.globalCategoryInput && !dom.globalCategoryInput.value.trim()) {
          dom.globalCategoryInput.value = norm.detectedCategory;
        }
        if (norm.stats.extractedAnswers > 0 || norm.stats.splitOptions > 0 || norm.stats.convertedBlanks > 0 || norm.stats.cleanedHeaders) {
          showToast(`🪄 智慧重構完成！${norm.summaryMessage}`, 'success');
        } else {
          showToast('題目格式已十分工整標準！可直接點擊「立即智慧解析並預覽」進入第二階段。', 'info');
        }
      });
    }

    // 載入 SDGs 自由格式題庫範例
    if (dom.btnLoadSdgsSample) {
      dom.btnLoadSdgsSample.addEventListener('click', () => {
        dom.rawInput.value = SAMPLE_SDGS_FREEFORM_TEXT;
        if (dom.globalCategoryInput) dom.globalCategoryInput.value = '永續發展目標 (SDGs)';
        updateCharCount();
        showToast('🌿 已載入「SDGs 永續發展自由格式題庫」！可點擊「🪄 自由格式智慧重構」檢視調整效果，或直接點擊「🚀 立即智慧解析並預覽」體驗二段式校對！', 'info');
      });
    }

    // 載入範例題目
    if (dom.btnLoadSample) {
      dom.btnLoadSample.addEventListener('click', () => {
        dom.rawInput.value = SAMPLE_AI_TEXT;
        updateCharCount();
        showToast('已載入 5 大題型綜合範例題庫！點擊下方按鈕即可立即解析', 'info');
      });
    }

    // 篩選僅看智慧規格化題目
    if (dom.btnFilterAutoNormalized && dom.pillFilterNormalized) {
      dom.btnFilterAutoNormalized.addEventListener('click', () => {
        dom.pillFilterNormalized.click();
      });
    }

    // 清空輸入
    if (dom.btnClearInput) {
      dom.btnClearInput.addEventListener('click', () => {
        if (confirm('確定要清空輸入區文字嗎？')) {
          dom.rawInput.value = '';
          updateCharCount();
          showToast('輸入區已清空', 'info');
        }
      });
    }

    // 解析文字
    if (dom.btnParse) {
      dom.btnParse.addEventListener('click', () => {
        parseInputText();
      });
    }

    // 新增題目
    if (dom.btnAddQuestion) {
      dom.btnAddQuestion.addEventListener('click', () => {
        addNewQuestion();
      });
    }

    // 清空全部題目
    if (dom.btnClearQuestions) {
      dom.btnClearQuestions.addEventListener('click', () => {
        if (!state.questions || state.questions.length === 0) {
          showToast('目前題庫已是清空狀態！', 'info');
          return;
        }
        if (confirm(`確定要清空目前全部 ${state.questions.length} 道題目嗎？此動作將清除當前編輯的所有題目，且無法復原！`)) {
          state.questions = [];
          saveToLocalStorage();
          updateStats();
          updateStage2WorkflowBanner();
          renderQuestionsList();
          showToast('已清空全部題目', 'info');
        }
      });
    }

    // 動態調整題目顯示字級大小
    if (dom.fontSizeBtns && dom.fontSizeBtns.length > 0) {
      dom.fontSizeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const size = btn.dataset.size;
          applyFontSize(size);
          const sizeName = { sm: '小 (16px)', md: '標準 (18px)', lg: '大 (21px)', xl: '特大 (24px)' }[size] || size;
          showToast(`已調整題目字型大小為「${sizeName}」`, 'info');
        });
      });
    }

    // 篩選標籤
    dom.filterBtns.forEach(pill => {
      pill.addEventListener('click', () => {
        dom.filterBtns.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.currentFilter = pill.dataset.filter;
        renderQuestionsList();
      });
    });

    // 搜尋框
    if (dom.searchInput) {
      dom.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase().trim();
        renderQuestionsList();
      });
    }

    // 匯出 ee-Class CSV (UTF-8 with BOM)
    if (dom.btnExportCsv) {
      dom.btnExportCsv.addEventListener('click', () => {
        exportQuiz('csv_utf8');
      });
    }

    // 匯出 Big5 副本 CSV (CP950)
    if (dom.btnExportBig5) {
      dom.btnExportBig5.addEventListener('click', () => {
        exportQuiz('csv_big5');
      });
    }

    // 匯出 GIFT 格式
    if (dom.btnExportGift) {
      dom.btnExportGift.addEventListener('click', () => {
        exportQuiz('gift');
      });
    }

    // 複製範例代碼按鈕
    document.querySelectorAll('[data-copy-target]').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.copyTarget;
        const targetElem = document.getElementById(targetId);
        if (targetElem) {
          const textToCopy = targetElem.innerText || targetElem.textContent;
          navigator.clipboard.writeText(textToCopy).then(() => {
            showToast('已成功複製範本內容到剪貼簿！', 'success');
          }).catch(() => {
            showToast('複製失敗，請手動反白選取複製', 'error');
          });
        }
      });
    });

    // 彈出視窗按鈕與遮罩關閉
    if (dom.modalBtnGoEditor) {
      dom.modalBtnGoEditor.addEventListener('click', () => {
        closeDiagnosticsModal();
        switchTab('editor');
        const warnPill = document.querySelector('.filter-pill[data-filter="warning"]');
        if (warnPill) warnPill.click();
      });
    }
    if (dom.modalBtnManual) {
      dom.modalBtnManual.addEventListener('click', () => {
        closeDiagnosticsModal();
        switchTab('manual');
      });
    }
    if (dom.modalBtnDismiss) {
      dom.modalBtnDismiss.addEventListener('click', () => {
        closeDiagnosticsModal();
      });
    }

    const btnCloseX = document.getElementById('modal-btn-close-x');
    if (btnCloseX) {
      btnCloseX.addEventListener('click', () => {
        closeDiagnosticsModal();
      });
    }

    // 點擊背景遮罩關閉
    if (dom.diagModal) {
      dom.diagModal.addEventListener('click', (e) => {
        if (e.target === dom.diagModal) {
          closeDiagnosticsModal();
        }
      });
    }

    // ESC 鍵關閉
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dom.diagModal && dom.diagModal.classList.contains('active')) {
        closeDiagnosticsModal();
      }
    });
  }

  /**
   * 處理檔案上傳（支援 .docx / .txt / .md / .csv）
   */
  async function handleUploadedFile(file) {
    if (!file) return;
    const name = file.name;
    const ext = name.substring(name.lastIndexOf('.')).toLowerCase();

    showToast(`正在讀取檔案「${name}」...`, 'info');

    try {
      if (ext === '.docx') {
        // 使用 JSZip 讀取 Word document.xml
        if (typeof JSZip === 'undefined') {
          showToast('JSZip 模組正在加載中，請稍候重試', 'error');
          return;
        }
        const zip = await JSZip.loadAsync(file);
        const docXml = await zip.file('word/document.xml').async('text');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(docXml, 'text/xml');
        const paragraphs = xmlDoc.getElementsByTagName('w:p');
        const lines = [];

        for (let i = 0; i < paragraphs.length; i++) {
          const textNodes = paragraphs[i].getElementsByTagName('w:t');
          let pText = '';
          for (let j = 0; j < textNodes.length; j++) {
            pText += textNodes[j].textContent || '';
          }
          lines.push(pText);
        }
        const extractedText = lines.join('\n');
        dom.rawInput.value = extractedText;
        updateCharCount();
        showToast(`已成功由 Word「${name}」抽取 ${paragraphs.length} 個段落，正在自動解析...`, 'success');
        parseInputText();
      } else if (['.txt', '.md', '.csv', '.tsv'].includes(ext)) {
        const reader = new FileReader();
        reader.onload = (e) => {
          dom.rawInput.value = e.target.result;
          updateCharCount();
          showToast(`已成功載入「${name}」，正在自動解析...`, 'success');
          parseInputText();
        };
        reader.readAsText(file, 'utf-8');
      } else {
        showToast(`不支援的檔案格式「${ext}」，請使用 .docx、.txt 或 .md`, 'error');
      }
    } catch (err) {
      console.error('File parsing error:', err);
      showToast(`檔案讀取失敗: ${err.message}`, 'error');
    }
  }

  /**
   * 切換分頁標籤
   */
  function switchTab(tabId) {
    state.activeTab = tabId;
    dom.tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    dom.tabContents.forEach(content => {
      content.classList.toggle('active', content.id === `tab-${tabId}`);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * 更新字數統計
   */
  function updateCharCount() {
    if (dom.rawInput && dom.charCount) {
      const len = dom.rawInput.value.length;
      dom.charCount.innerText = `${len.toLocaleString()} 字`;
    }
  }

  /**
   * 解析輸入文字
   */
  function parseInputText() {
    const text = dom.rawInput.value.trim();
    if (!text) {
      showToast('請先貼上題目內容或拖曳考題檔！', 'warning');
      return;
    }

    try {
      const parsed = QuizParser.parseQuizText(text);
      if (parsed.length === 0) {
        showToast('無法辨識出任何題目，請參閱右側或「格式規範手冊」檢查標題格式。', 'error');
        return;
      }

      // 若檢測出考卷主題，且全域類別為空，自動填入全域類別
      if (parsed.detectedCategory && dom.globalCategoryInput && !dom.globalCategoryInput.value.trim()) {
        dom.globalCategoryInput.value = parsed.detectedCategory;
      }

      // 若有全域類別且題目未填類別，自動套用
      const globalCat = dom.globalCategoryInput ? dom.globalCategoryInput.value.trim() : '';
      if (globalCat) {
        parsed.forEach(q => {
          if (!q.category) q.category = globalCat;
        });
      }

      state.questions = parsed;
      saveToLocalStorage();
      updateStats();
      updateStage2WorkflowBanner();
      renderQuestionsList();
      switchTab('editor');

      // 執行嚴格檢核
      const validation = QuizParser.validateQuestions(state.questions);
      const normCount = state.questions.filter(q => q.wasAutoNormalized).length;
      if (validation.isValid) {
        if (normCount > 0) {
          showToast(`🎉 成功解析 ${parsed.length} 題（其中 ${normCount} 題經第一階段智慧重構自動對齊）！請進行第二階段覆核。`, 'success');
        } else {
          showToast(`🎉 成功解析 ${parsed.length} 道題目！通過 100% 格式防呆檢核！`, 'success');
        }
      } else {
        showToast(`解析出 ${parsed.length} 道題目，但發現 ${validation.errorCount} 道題目有瑕疵，請在下方卡片中校對！`, 'warning');
      }
    } catch (err) {
      console.error('Parser error:', err);
      showToast('解析時發生非預期錯誤，請檢查文字中是否有特殊符號。', 'error');
    }
  }

  /**
   * 更新頂部數據指標
   */
  function updateStats() {
    const total = state.questions.length;
    let tfCount = 0;
    let singleCount = 0;
    let multiCount = 0;
    let fillCount = 0;
    let essayCount = 0;
    let warningCount = 0;

    state.questions.forEach(q => {
      if (q.type === 1) tfCount++;
      else if (q.type === 2) singleCount++;
      else if (q.type === 3) multiCount++;
      else if (q.type === 4) fillCount++;
      else if (q.type === 5) essayCount++;

      // 檢查是否有答案未設定
      if (q.type === 1 && (q.answer !== 1 && q.answer !== 2)) warningCount++;
      else if (q.type === 2 && (!q.answer || q.answer < 1 || q.answer > (q.options ? q.options.length : 0))) warningCount++;
      else if (q.type === 3 && (!q.answer || !String(q.answer).trim())) warningCount++;
      else if (q.type === 4 && (!q.stem || !/\[\*([^*]+)\*\]/.test(q.stem))) warningCount++;
    });

    if (dom.statTotal) dom.statTotal.innerText = total;
    if (dom.statTf) dom.statTf.innerText = tfCount;
    if (dom.statSingle) dom.statSingle.innerText = singleCount;
    if (dom.statMulti) dom.statMulti.innerText = multiCount;
    if (dom.statFill) dom.statFill.innerText = fillCount;
    if (dom.statEssay) dom.statEssay.innerText = essayCount;
    if (dom.tabBadgeCount) dom.tabBadgeCount.innerText = total;

    if (dom.statWarning) {
      if (warningCount > 0) {
        dom.statWarning.style.display = 'inline-flex';
        dom.statWarning.innerHTML = `⚠️ 待修正: <strong>${warningCount}</strong>`;
      } else {
        dom.statWarning.style.display = 'none';
      }
    }
  }

  /**
   * 更新第二階段工作流橫幅狀態 (Two-Stage Workflow Banner)
   */
  function updateStage2WorkflowBanner() {
    if (!dom.stage2WorkflowBanner) return;
    const total = state.questions.length;
    if (total === 0) {
      dom.stage2WorkflowBanner.style.display = 'none';
      return;
    }
    dom.stage2WorkflowBanner.style.display = 'flex';

    const normCount = state.questions.filter(q => q.wasAutoNormalized).length;
    if (dom.stage2NormCount) dom.stage2NormCount.innerText = normCount;
    if (dom.normFilterBadgeCount) dom.normFilterBadgeCount.innerText = normCount;

    if (dom.stage2BannerDesc) {
      if (normCount > 0) {
        dom.stage2BannerDesc.innerHTML = `第一階段智慧重構引擎已自動調整 <strong>${normCount}</strong> 道非標準題目（自題幹括號提取答案、展開併排選項或重構填空標籤）。請在下方卡片中快速手動覆核；若需微調答案、選項或題型，可直接點擊卡片修改，零瑕疵確認後即可安心匯出！`;
        if (dom.stage2NormBadge) dom.stage2NormBadge.style.display = 'inline-flex';
      } else {
        dom.stage2BannerDesc.innerHTML = `所有題目格式皆完全標準！請在下方卡片快速檢視確認，若需微調可隨時修改，確認無誤後即可點擊右上角匯出 ee-Class 官方 CSV 或 Big5 副本。`;
        if (dom.stage2NormBadge) dom.stage2NormBadge.style.display = 'none';
      }
    }
  }

  /**
   * 渲染題目預覽卡片清單
   */
  function renderQuestionsList() {
    if (!dom.questionsList) return;
    dom.questionsList.innerHTML = '';

    let filtered = state.questions.filter(q => {
      // 題型篩選
      if (state.currentFilter === 'single' && q.type !== 2) return false;
      if (state.currentFilter === 'tf' && q.type !== 1) return false;
      if (state.currentFilter === 'multi' && q.type !== 3) return false;
      if (state.currentFilter === 'fill' && q.type !== 4) return false;
      if (state.currentFilter === 'essay' && q.type !== 5) return false;
      if (state.currentFilter === 'normalized' && !q.wasAutoNormalized) return false;
      if (state.currentFilter === 'warning') {
        const hasAns = (q.type === 1 && (q.answer === 1 || q.answer === 2)) ||
                       (q.type === 2 && q.answer >= 1 && q.answer <= (q.options ? q.options.length : 0)) ||
                       (q.type === 3 && q.answer) ||
                       (q.type === 4 && /\[\*([^*]+)\*\]/.test(q.stem || '')) ||
                       (q.type === 5);
        if (hasAns) return false;
      }

      // 搜尋篩選
      if (state.searchQuery) {
        const stemMatch = (q.stem || '').toLowerCase().includes(state.searchQuery);
        const expMatch = (q.explanation || '').toLowerCase().includes(state.searchQuery);
        const catMatch = (q.category || '').toLowerCase().includes(state.searchQuery);
        const optMatch = Array.isArray(q.options) && q.options.some(opt => opt.toLowerCase().includes(state.searchQuery));
        if (!stemMatch && !expMatch && !optMatch && !catMatch) return false;
      }

      return true;
    });

    if (filtered.length === 0) {
      if (dom.emptyState) dom.emptyState.style.display = 'block';
      return;
    } else {
      if (dom.emptyState) dom.emptyState.style.display = 'none';
    }

    filtered.forEach((q, displayIdx) => {
      const card = createQuestionCard(q, displayIdx + 1);
      dom.questionsList.appendChild(card);
    });
  }

  /**
   * 建立單道題目卡片 DOM
   */
  function createQuestionCard(q, displayIndex) {
    const card = document.createElement('div');
    card.className = 'glass-panel question-card';
    card.dataset.id = q.id;

    // 題型設定
    let typeName = '單選題';
    let typeClass = 'badge-type-2';
    if (q.type === 1) { typeName = '是非題'; typeClass = 'badge-type-1'; }
    else if (q.type === 2) { typeName = '單選題'; typeClass = 'badge-type-2'; }
    else if (q.type === 3) { typeName = '複選題'; typeClass = 'badge-type-3'; }
    else if (q.type === 4) { typeName = '填充題'; typeClass = 'badge-type-4'; }
    else if (q.type === 5) { typeName = '問答題'; typeClass = 'badge-type-5'; }

    // 檢核此題是否有瑕疵
    let hasError = false;
    let errorMsg = '';
    if (q.type === 1 && q.answer !== 1 && q.answer !== 2) {
      hasError = true; errorMsg = '未設定正確答案 (是/否)';
    } else if (q.type === 2 && (!q.answer || q.answer < 1 || q.answer > (q.options ? q.options.length : 0))) {
      hasError = true; errorMsg = '未設定選項答案或超出選項數';
    } else if (q.type === 3 && (!q.answer || !String(q.answer).trim())) {
      hasError = true; errorMsg = '未勾選複選正確答案';
    } else if (q.type === 4 && (!q.stem || !/\[\*([^*]+)\*\]/.test(q.stem))) {
      hasError = true; errorMsg = '題幹缺少 [*空格答案*] 標記';
    }

    // 卡片頂部
    const header = document.createElement('div');
    header.className = 'q-card-header';
    header.innerHTML = `
      <div class="q-card-title-group">
        <span class="q-num-badge">#${q.index || displayIndex}</span>
        <select class="q-type-select" title="點擊切換題型，或選擇刪除此題">
          <option value="1" ${q.type === 1 ? 'selected' : ''}>📝 是非題</option>
          <option value="2" ${q.type === 2 ? 'selected' : ''}>🔘 單選題</option>
          <option value="3" ${q.type === 3 ? 'selected' : ''}>☑️ 複選題</option>
          <option value="4" ${q.type === 4 ? 'selected' : ''}>✏️ 填充題</option>
          <option value="5" ${q.type === 5 ? 'selected' : ''}>📄 問答題</option>
          <option disabled>──────────</option>
          <option value="delete" class="opt-delete-action">🗑️ 刪除此題</option>
        </select>
        <div class="card-category-field" title="所屬類別 / 章節名稱">
          🏷️ <input type="text" class="card-cat-input" value="${escapeHtml(q.category || '')}" placeholder="無類別（點此輸入）">
        </div>
        ${q.wasAutoNormalized ? `<span class="badge-auto-normalized" title="${escapeHtml(q.normalizeReason || '經第一階段智慧重構自動對齊，請手動確認')}">🪄 智慧規格化</span>` : ''}
        ${hasError ? `<span class="badge-status-error" title="${errorMsg}">⚠️ ${errorMsg}</span>` : ''}
      </div>
      <div class="q-card-actions">
        <button class="btn-icon btn-move-up" title="向上移動" ${displayIndex === 1 ? 'disabled' : ''}>▲</button>
        <button class="btn-icon btn-move-down" title="向下移動" ${displayIndex === state.questions.length ? 'disabled' : ''}>▼</button>
        <button class="btn-icon btn-duplicate" title="複製題目">📑</button>
        <button class="btn-icon btn-delete" title="刪除此題">🗑️</button>
      </div>
    `;

    // 題型即時切換與刪除處理
    const typeSelect = header.querySelector('.q-type-select');
    if (typeSelect) {
      typeSelect.addEventListener('change', (e) => {
        const selectedVal = e.target.value;
        if (selectedVal === 'delete') {
          // 先復原選單選項至原題型，避免若使用者取消確認對話框時仍停留在「刪除此題」
          e.target.value = String(q.type);
          deleteQuestion(q.id);
          return;
        }

        const newType = parseInt(selectedVal, 10);
        q.type = newType;
        if (newType === 1) { // 是非題
          q.options = [];
          if (q.answer !== 1 && q.answer !== 2) q.answer = null;
        } else if (newType === 2 || newType === 3) { // 選擇題
          if (!q.options || q.options.length < 2) {
            q.options = ['選項 A', '選項 B', '選項 C', '選項 D'];
          }
          if (newType === 2 && (typeof q.answer !== 'number' || q.answer < 1)) q.answer = 1;
          if (newType === 3 && typeof q.answer !== 'string') q.answer = '1';
        } else if (newType === 4) { // 填充題
          q.options = [];
          q.answer = '';
          if (!/\[\*([^*]+)\*\]/.test(q.stem)) {
            q.stem += ' [*答案*]';
          }
        } else if (newType === 5) { // 問答題
          q.options = [];
        }
        saveToLocalStorage();
        updateStats();
        updateStage2WorkflowBanner();
        renderQuestionsList();
        showToast(`已將第 ${displayIndex} 題切換為「${e.target.options[e.target.selectedIndex].text}」`, 'info');
      });
    }

    // 類別即時編輯
    const catInput = header.querySelector('.card-cat-input');
    catInput.addEventListener('change', (e) => {
      q.category = e.target.value.trim();
      saveToLocalStorage();
    });

    // 移動 / 複製 / 刪除
    header.querySelector('.btn-move-up').addEventListener('click', () => moveQuestion(q.id, -1));
    header.querySelector('.btn-move-down').addEventListener('click', () => moveQuestion(q.id, 1));
    header.querySelector('.btn-duplicate').addEventListener('click', () => duplicateQuestion(q.id));
    header.querySelector('.btn-delete').addEventListener('click', () => deleteQuestion(q.id));

    // 題幹文字編輯
    const stemGroup = document.createElement('div');
    stemGroup.className = 'form-group';
    stemGroup.innerHTML = `
      <label class="form-label" style="display:flex; justify-content:space-between; align-items:center;">
        <span>題幹文字：</span>
        ${q.type === 4 ? `<button class="btn btn-secondary btn-sm btn-insert-blank">➕ 插入 [*答案*] 標記</button>` : ''}
      </label>
      <textarea class="form-input q-stem-input" rows="3" placeholder="請在此輸入題幹內容...">${escapeHtml(q.stem || '')}</textarea>
    `;
    const stemTextarea = stemGroup.querySelector('.q-stem-input');
    stemTextarea.addEventListener('input', (e) => {
      q.stem = e.target.value;
      saveToLocalStorage();
      updateStats();
    });

    if (q.type === 4) {
      const btnInsert = stemGroup.querySelector('.btn-insert-blank');
      btnInsert.addEventListener('click', (e) => {
        e.preventDefault();
        const start = stemTextarea.selectionStart;
        const end = stemTextarea.selectionEnd;
        const val = stemTextarea.value;
        const selected = val.substring(start, end) || '空格答案';
        stemTextarea.value = val.substring(0, start) + `[*${selected}*]` + val.substring(end);
        q.stem = stemTextarea.value;
        saveToLocalStorage();
        renderQuestionsList();
      });
    }

    // 核心作答與選項區 (依 5 大題型區分)
    const answerContainer = document.createElement('div');
    answerContainer.className = 'answer-interactive-area';

    // 1. 是非題 (Type 1)
    if (q.type === 1) {
      answerContainer.innerHTML = `
        <div class="tf-btn-group">
          <button class="tf-btn ${q.answer === 1 ? 'selected' : ''}" data-val="1">
            ⭕ 是 (True / 正確)
          </button>
          <button class="tf-btn ${q.answer === 2 ? 'selected' : ''}" data-val="2">
            ❌ 否 (False / 錯誤)
          </button>
        </div>
      `;
      answerContainer.querySelectorAll('.tf-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          q.answer = parseInt(btn.dataset.val, 10);
          saveToLocalStorage();
          updateStats();
          renderQuestionsList();
        });
      });
    }
    // 2. 單選題 (Type 2)
    else if (q.type === 2) {
      const optList = document.createElement('div');
      optList.className = 'options-edit-list';
      const opts = Array.isArray(q.options) ? q.options : [];

      opts.forEach((optText, optIdx) => {
        const letter = String.fromCharCode(65 + optIdx);
        const isCorrect = q.answer === (optIdx + 1);
        const optRow = document.createElement('div');
        optRow.className = `option-item ${isCorrect ? 'is-correct' : ''}`;
        optRow.innerHTML = `
          <button class="opt-select-btn ${isCorrect ? 'active' : ''}" title="設為正確答案">
            ${isCorrect ? '●' : '○'}
          </button>
          <span class="opt-letter">${letter}.</span>
          <input type="text" class="opt-text-input form-input" value="${escapeHtml(optText || '')}">
          <button class="opt-del-btn" title="刪除選項">×</button>
        `;

        optRow.querySelector('.opt-select-btn').addEventListener('click', () => {
          q.answer = optIdx + 1;
          saveToLocalStorage();
          updateStats();
          renderQuestionsList();
        });

        optRow.querySelector('.opt-text-input').addEventListener('input', (e) => {
          q.options[optIdx] = e.target.value;
          saveToLocalStorage();
        });

        optRow.querySelector('.opt-del-btn').addEventListener('click', () => {
          if (q.options.length <= 2) {
            showToast('單選題至少需保留 2 個選項！', 'warning');
            return;
          }
          q.options.splice(optIdx, 1);
          if (q.answer === optIdx + 1) q.answer = null;
          else if (q.answer > optIdx + 1) q.answer--;
          saveToLocalStorage();
          updateStats();
          renderQuestionsList();
        });

        optList.appendChild(optRow);
      });

      const addOptBtn = document.createElement('button');
      addOptBtn.className = 'btn btn-secondary btn-sm';
      addOptBtn.style.marginTop = '0.5rem';
      addOptBtn.innerText = '➕ 新增選項';
      addOptBtn.addEventListener('click', () => {
        if (q.options.length >= 20) {
          showToast('ee-Class 最多支援 20 個選項！', 'warning');
          return;
        }
        q.options.push('新選項');
        saveToLocalStorage();
        renderQuestionsList();
      });

      answerContainer.appendChild(optList);
      answerContainer.appendChild(addOptBtn);
    }
    // 3. 複選題 (Type 3)
    else if (q.type === 3) {
      const optList = document.createElement('div');
      optList.className = 'options-edit-list';
      const opts = Array.isArray(q.options) ? q.options : [];
      const selectedAnswers = String(q.answer || '')
        .split(',')
        .map(n => parseInt(n.trim(), 10))
        .filter(n => !isNaN(n));

      opts.forEach((optText, optIdx) => {
        const letter = String.fromCharCode(65 + optIdx);
        const isChecked = selectedAnswers.includes(optIdx + 1);
        const optRow = document.createElement('div');
        optRow.className = `option-item multi-choice-item ${isChecked ? 'is-correct' : ''}`;
        optRow.innerHTML = `
          <div class="custom-checkbox ${isChecked ? 'checked' : ''}" title="勾選為正確答案">
            ${isChecked ? '✓' : ''}
          </div>
          <span class="opt-letter" style="color:var(--accent-emerald);">${letter}.</span>
          <input type="text" class="opt-text-input form-input" value="${escapeHtml(optText || '')}">
          <button class="opt-del-btn" title="刪除選項">×</button>
        `;

        const chkBox = optRow.querySelector('.custom-checkbox');
        chkBox.addEventListener('click', () => {
          let updated = [...selectedAnswers];
          const num = optIdx + 1;
          if (updated.includes(num)) {
            updated = updated.filter(n => n !== num);
          } else {
            updated.push(num);
          }
          updated.sort((a, b) => a - b);
          q.answer = updated.join(',');
          saveToLocalStorage();
          updateStats();
          renderQuestionsList();
        });

        optRow.querySelector('.opt-text-input').addEventListener('input', (e) => {
          q.options[optIdx] = e.target.value;
          saveToLocalStorage();
        });

        optRow.querySelector('.opt-del-btn').addEventListener('click', () => {
          if (q.options.length <= 2) {
            showToast('複選題至少需保留 2 個選項！', 'warning');
            return;
          }
          q.options.splice(optIdx, 1);
          // 重新計算答案編號
          let updated = selectedAnswers
            .filter(n => n !== optIdx + 1)
            .map(n => (n > optIdx + 1 ? n - 1 : n))
            .sort((a, b) => a - b);
          q.answer = updated.join(',');
          saveToLocalStorage();
          updateStats();
          renderQuestionsList();
        });

        optList.appendChild(optRow);
      });

      const addOptBtn = document.createElement('button');
      addOptBtn.className = 'btn btn-secondary btn-sm';
      addOptBtn.style.marginTop = '0.5rem';
      addOptBtn.innerText = '➕ 新增複選選項';
      addOptBtn.addEventListener('click', () => {
        if (q.options.length >= 20) {
          showToast('ee-Class 最多支援 20 個選項！', 'warning');
          return;
        }
        q.options.push('新選項');
        saveToLocalStorage();
        renderQuestionsList();
      });

      answerContainer.appendChild(optList);
      answerContainer.appendChild(addOptBtn);
    }
    // 4. 填充題 (Type 4)
    else if (q.type === 4) {
      const blanks = [];
      const bRegex = /\[\*([^*]+)\*\]/g;
      let bm;
      while ((bm = bRegex.exec(q.stem || '')) !== null) {
        blanks.push(bm[1].trim());
      }

      answerContainer.innerHTML = `
        <div class="fillin-editor-wrapper">
          <div class="fillin-tags-title">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
            題幹中萃取出的答案空格 (共 ${blanks.length} 格)：
          </div>
          <div class="fillin-tags-container">
            ${blanks.length > 0 ? blanks.map((b, i) => `<span class="fillin-tag-pill">第 ${i+1} 格: ${escapeHtml(b)}</span>`).join('') : '<span style="color:var(--accent-rose); font-size:0.85rem;">⚠️ 尚未偵測到空格，請在題幹中以 [*答案*] 標記！</span>'}
          </div>
          <div class="fillin-settings-grid">
            <div class="fillin-setting-item">
              <label>選項 1: 英文大小寫比對</label>
              <select class="fillin-opt1-select">
                <option value="1" ${q.caseSensitive === 1 ? 'selected' : ''}>1: 不分英文大小寫 (預設)</option>
                <option value="2" ${q.caseSensitive === 2 ? 'selected' : ''}>2: 區分英文大小寫</option>
              </select>
            </div>
            <div class="fillin-setting-item">
              <label>選項 2: 填答順序比對</label>
              <select class="fillin-opt2-select">
                <option value="1" ${q.ordered === 1 ? 'selected' : ''}>1: 不考慮順序 (預設)</option>
                <option value="2" ${q.ordered === 2 ? 'selected' : ''}>2: 需考慮順序</option>
              </select>
            </div>
          </div>
        </div>
      `;

      answerContainer.querySelector('.fillin-opt1-select').addEventListener('change', (e) => {
        q.caseSensitive = parseInt(e.target.value, 10);
        saveToLocalStorage();
      });
      answerContainer.querySelector('.fillin-opt2-select').addEventListener('change', (e) => {
        q.ordered = parseInt(e.target.value, 10);
        saveToLocalStorage();
      });
    }
    // 5. 問答題 (Type 5)
    else if (q.type === 5) {
      answerContainer.innerHTML = `
        <div class="essay-editor-wrapper">
          <label>📝 參考答案 / 評分標準：</label>
          <textarea class="essay-ans-input" rows="3" placeholder="請在此輸入參考答案內容...">${escapeHtml(q.answer || '')}</textarea>
        </div>
      `;
      answerContainer.querySelector('.essay-ans-input').addEventListener('input', (e) => {
        q.answer = e.target.value;
        saveToLocalStorage();
      });
    }

    // 解析與難易度底欄
    const metaRow = document.createElement('div');
    metaRow.className = 'q-meta-row';
    metaRow.innerHTML = `
      <div class="form-group" style="flex: 1; margin-bottom: 0;">
        <label class="form-label">題目解析 / 說明：</label>
        <input type="text" class="form-input q-exp-input" value="${escapeHtml(q.explanation || '')}" placeholder="建議填寫詳解，便於考後檢討">
      </div>
      <div class="form-group" style="width: 140px; margin-bottom: 0;">
        <label class="form-label">難易度：</label>
        <select class="form-input q-diff-select">
          <option value="1" ${q.difficulty === 1 ? 'selected' : ''}>容易</option>
          <option value="2" ${q.difficulty === 2 ? 'selected' : ''}>適中</option>
          <option value="3" ${q.difficulty === 3 ? 'selected' : ''}>困難</option>
        </select>
      </div>
    `;

    metaRow.querySelector('.q-exp-input').addEventListener('input', (e) => {
      q.explanation = e.target.value;
      saveToLocalStorage();
    });
    metaRow.querySelector('.q-diff-select').addEventListener('change', (e) => {
      q.difficulty = parseInt(e.target.value, 10);
      saveToLocalStorage();
    });

    card.appendChild(header);
    card.appendChild(stemGroup);
    card.appendChild(answerContainer);
    card.appendChild(metaRow);

    return card;
  }

  /**
   * 題目上下排序
   */
  function moveQuestion(id, direction) {
    const idx = state.questions.findIndex(q => q.id === id);
    if (idx === -1) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= state.questions.length) return;

    const temp = state.questions[idx];
    state.questions[idx] = state.questions[targetIdx];
    state.questions[targetIdx] = temp;

    // 重新編定 index
    state.questions.forEach((q, i) => q.index = i + 1);

    saveToLocalStorage();
    renderQuestionsList();
  }

  /**
   * 複製題目
   */
  function duplicateQuestion(id) {
    const target = state.questions.find(q => q.id === id);
    if (!target) return;
    const copy = JSON.parse(JSON.stringify(target));
    copy.id = 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    copy.stem = copy.stem + ' (副本)';
    const idx = state.questions.findIndex(q => q.id === id);
    state.questions.splice(idx + 1, 0, copy);
    state.questions.forEach((q, i) => q.index = i + 1);
    saveToLocalStorage();
    updateStats();
    renderQuestionsList();
    showToast('已複製題目', 'info');
  }

  /**
   * 刪除題目
   */
  function deleteQuestion(id) {
    const qItem = state.questions.find(q => q.id === id);
    const qNum = qItem ? (qItem.index || '') : '';
    const stemSnippet = qItem && qItem.stem ? (qItem.stem.slice(0, 36) + (qItem.stem.length > 36 ? '...' : '')) : '';
    const confirmPrompt = stemSnippet
      ? `確定要刪除第 ${qNum} 題嗎？\n\n「${stemSnippet}」\n\n此動作無法復原。`
      : `確定要刪除第 ${qNum} 題嗎？此動作無法復原。`;
    if (confirm(confirmPrompt)) {
      state.questions = state.questions.filter(q => q.id !== id);
      state.questions.forEach((q, i) => q.index = i + 1);
      saveToLocalStorage();
      updateStats();
      updateStage2WorkflowBanner();
      renderQuestionsList();
      showToast(`第 ${qNum} 題已成功刪除`, 'info');
    }
  }

  /**
   * 新增一道題目
   */
  function addNewQuestion() {
    const newQ = {
      id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      index: state.questions.length + 1,
      type: 2, // 預設單選題
      category: state.globalCategory || '',
      stem: '請在此輸入新題幹內容...',
      options: ['選項 A', '選項 B', '選項 C', '選項 D'],
      answer: 1,
      explanation: '',
      difficulty: 2,
      caseSensitive: 1,
      ordered: 1
    };
    state.questions.unshift(newQ);
    state.questions.forEach((q, i) => q.index = i + 1);
    saveToLocalStorage();
    updateStats();
    renderQuestionsList();
    showToast('已新增題目至最頂端！', 'success');
  }

  /**
   * 匯出題庫檔案 (核心執行防呆阻擋)
   */
  async function exportQuiz(formatType) {
    if (state.questions.length === 0) {
      showToast('目前題庫沒有任何題目可匯出！', 'warning');
      return;
    }

    // 嚴格檢核防呆
    const validation = QuizParser.validateQuestions(state.questions);
    if (!validation.isValid) {
      openDiagnosticsModal(validation);
      return;
    }

    const globalCat = dom.globalCategoryInput ? dom.globalCategoryInput.value.trim() : state.globalCategory;
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    try {
      if (formatType === 'csv_utf8') {
        const csvContent = QuizExporter.generateEeclassCsv(state.questions, globalCat, { withBom: true });
        QuizExporter.triggerDownload(csvContent, `eeclass_quiz_${timestamp}.csv`, 'text/csv;charset=utf-8');
        showToast('📥 成功匯出 ee-Class 官方標準 CSV (UTF-8 with BOM)！', 'success');
      } else if (formatType === 'csv_big5') {
        showToast('⏳ 正在以 Big5 (CP950) 二進位轉碼並執行符號等義修復...', 'info');
        await QuizExporter.exportBig5Csv(state.questions, globalCat, `eeclass_quiz_${timestamp}_big5.csv`);
        showToast('📑 成功匯出 Big5 副本 CSV！可直接上傳舊版測驗系統。', 'success');
      } else if (formatType === 'gift') {
        const giftContent = QuizExporter.generateGift(state.questions, globalCat);
        QuizExporter.triggerDownload(giftContent, `eeclass_quiz_${timestamp}.gift`, 'text/plain;charset=utf-8');
        showToast('🎁 成功匯出 GIFT 格式檔案！', 'success');
      }
    } catch (err) {
      console.error('Export error:', err);
      showToast(`匯出失敗: ${err.message}`, 'error');
    }
  }

  /**
   * 打開防呆診斷視窗
   */
  function openDiagnosticsModal(validation) {
    if (!dom.diagModal) return;
    dom.modalErrCount.innerText = `${validation.errorCount} 項錯誤阻擋`;
    dom.modalWarnCount.innerText = `${validation.warningCount} 項建議`;
    dom.modalIssuesList.innerHTML = '';

    validation.issues.forEach(issue => {
      const item = document.createElement('div');
      item.className = `diag-item diag-${issue.severity}`;
      item.innerHTML = `
        <div class="diag-item-content">
          <div class="diag-item-msg">
            <span class="diag-severity-tag">${issue.severity === 'error' ? '🚫 錯誤阻擋' : '💡 建議'}</span>
            ${escapeHtml(issue.message)}
          </div>
        </div>
        <button class="btn btn-secondary btn-sm diag-fix-btn">前往修正</button>
      `;

      item.querySelector('.diag-fix-btn').addEventListener('click', () => {
        closeDiagnosticsModal();
        switchTab('editor');
        setTimeout(() => {
          const card = document.querySelector(`.question-card[data-id="${issue.id}"]`);
          if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.style.boxShadow = '0 0 25px rgba(244, 63, 94, 0.8)';
            setTimeout(() => card.style.boxShadow = '', 2500);
          }
        }, 300);
      });

      dom.modalIssuesList.appendChild(item);
    });

    dom.diagModal.style.display = 'flex';
    dom.diagModal.classList.add('active');
  }

  /**
   * 關閉防呆診斷視窗
   */
  function closeDiagnosticsModal() {
    if (dom.diagModal) {
      dom.diagModal.classList.remove('active');
      dom.diagModal.style.display = 'none';
    }
  }

  /**
   * Toast 訊息提示
   */
  function showToast(message, type = 'info') {
    if (!dom.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    else if (type === 'warning') icon = '⚠️';
    else if (type === 'error') icon = '❌';

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-text">${escapeHtml(message)}</span>
    `;

    dom.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'toastOut 0.3s forwards ease-in';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  /**
   * 本地儲存持久化
   */
  function saveToLocalStorage() {
    try {
      localStorage.setItem('eeclass_quiz_questions_pro', JSON.stringify(state.questions));
      if (dom.globalCategoryInput) {
        localStorage.setItem('eeclass_global_category', dom.globalCategoryInput.value.trim());
      }
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  function loadFromLocalStorage() {
    try {
      const stored = localStorage.getItem('eeclass_quiz_questions_pro');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          state.questions = parsed;
          renderQuestionsList();
        }
      }
      const storedCat = localStorage.getItem('eeclass_global_category');
      if (storedCat && dom.globalCategoryInput) {
        dom.globalCategoryInput.value = storedCat;
        state.globalCategory = storedCat;
      }
    } catch (e) {
      console.warn('LocalStorage load failed:', e);
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  init();
});
