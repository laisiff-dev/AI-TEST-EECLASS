/**
 * ee-Class 智慧題目轉換系統 - 主程式邏輯 (App Controller)
 */

document.addEventListener('DOMContentLoaded', () => {
  // 狀態存儲
  let state = {
    questions: [],
    activeTab: 'parser',
    currentFilter: 'all',
    searchQuery: '',
    theme: localStorage.getItem('eeclass_theme') || 'dark'
  };

  // 預設範例題目（取材自真實環境微生物學課程）
  const SAMPLE_AI_TEXT = `一、單選題
1. 下列何者最能區分原核細胞與真核細胞？
(A) 是否具有真正由核膜包覆的細胞核
(B) 是否能進行能量代謝
(C) 是否含有DNA
(D) 是否可存在於水環境中
答案：A
解析：原核細胞沒有真正由核膜包覆的細胞核；真核細胞則有。
難易度：適中

2. 在解析度公式 d≈0.61λ/NA 中，若其他條件相同，NA 增加時 d 會：
(A) 增加
(B) 減少
(C) 不變
(D) 先增加再減少
答案：B
解析：d越小代表可分辨更接近的兩點，因此解析度更好。
難易度：適中

3. 下列何者與產甲烷作用最直接相關？
(A) Methanogenic Archaea
(B) Cyanobacteria
(C) Protozoa
(D) Fungi
答案：A
解析：產甲烷作用為特定古菌的重要代謝。
難易度：容易

4. 污水處理廠推動淨零時，除能源效率外還應特別關注：
(A) N2O與CH4排放
(B) 只看pH
(C) 只看SS
(D) 只看菌體顏色
答案：A
解析：N2O與CH4都是污水處理重要溫室氣體來源。
難易度：容易

二、是非題
1. 細菌（Bacteria）與古菌（Archaea）皆屬原核生物，但在細胞膜脂質與細胞壁組成上存在重要差異。
答案：O
解析：兩者都沒有真正細胞核，但古菌常具有醚鍵脂質，且細胞壁不具典型細菌式肽聚糖。
難易度：適中

2. 藍綠菌（Cyanobacteria）屬於真核藻類，因此具有真正細胞核。
答案：X
解析：藍綠菌屬細菌域，為原核生物，不具有真正細胞核。
難易度：容易

3. MBR 系統中，提高 MLSS 越高越好，因為一定能提高處理效率且不增加膜污染。
答案：X
解析：過高MLSS可能增加黏度、傳質阻力與膜污染，不是越高越好。
難易度：適中

4. 活性污泥中的原生動物與後生動物可反映系統負荷、污泥齡與處理穩定度。
答案：O
解析：微動物群落可作為生物相指標，但需配合操作數據判讀。
難易度：容易
`;

  // DOM 元素快取
  const dom = {
    // 統計指標
    statTotal: document.getElementById('stat-total'),
    statSingle: document.getElementById('stat-single'),
    statTf: document.getElementById('stat-tf'),
    statWarning: document.getElementById('stat-warning'),
    tabBadgeCount: document.getElementById('tab-badge-count'),

    // 頁籤按鈕與容器
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),

    // 輸入區
    rawInput: document.getElementById('raw-quiz-input'),
    charCount: document.getElementById('input-char-count'),
    btnParse: document.getElementById('btn-parse-text'),
    btnLoadSample: document.getElementById('btn-load-sample'),
    btnClearInput: document.getElementById('btn-clear-input'),
    btnGotoManual: document.getElementById('btn-goto-manual'),
    btnGuideToManual: document.getElementById('btn-guide-to-manual'),

    // 編輯器區
    questionsList: document.getElementById('questions-container'),
    emptyState: document.getElementById('empty-state'),
    filterBtns: document.querySelectorAll('.filter-pill'),
    searchInput: document.getElementById('search-questions-input'),
    btnAddQuestion: document.getElementById('btn-add-question'),

    // 匯出按鈕
    btnExportCsv: document.getElementById('btn-export-csv'),
    btnExportGift: document.getElementById('btn-export-gift'),
    btnThemeToggle: document.getElementById('btn-theme-toggle'),

    // 格式診斷彈窗元件
    modalOverlay: document.getElementById('diagnostics-modal-overlay'),
    modalTitle: document.getElementById('modal-title'),
    modalSubtitle: document.getElementById('modal-subtitle'),
    modalIconBadge: document.getElementById('modal-icon-badge'),
    modalCloseBtn: document.getElementById('modal-close-btn'),
    diagCriticalChip: document.getElementById('diag-critical-chip'),
    diagWarningChip: document.getElementById('diag-warning-chip'),
    modalIssuesList: document.getElementById('modal-issues-list'),
    modalBtnFix: document.getElementById('modal-btn-fix'),
    modalBtnManual: document.getElementById('modal-btn-manual'),
    modalBtnDismiss: document.getElementById('modal-btn-dismiss'),

    // Toast 容器
    toastContainer: document.getElementById('toast-container')
  };

  // 初始化主題
  function initTheme() {
    if (state.theme === 'light') {
      document.body.classList.add('light-theme');
      dom.btnThemeToggle.innerHTML = '<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>';
    } else {
      document.body.classList.remove('light-theme');
      dom.btnThemeToggle.innerHTML = '<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 9H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>';
    }
  }

  // 切換主題
  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('eeclass_theme', state.theme);
    initTheme();
    showToast(`已切換至${state.theme === 'dark' ? '深色' : '淺色'}模式`, 'info');
  }

  // Toast 訊息提示
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
    } else {
      iconSvg = '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
    }

    toast.innerHTML = `${iconSvg}<span>${message}</span>`;
    dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // 更新統計數據與嚴格檢核警告
  function updateStats() {
    const total = state.questions.length;
    let singleCount = 0;
    let tfCount = 0;

    state.questions.forEach(q => {
      if (q.type === QuizParser.QuestionType.SINGLE_CHOICE) {
        singleCount++;
      } else {
        tfCount++;
      }
    });

    // 嚴格檢核計算
    const validation = QuizParser.validateQuestions(state.questions);
    const criticalCount = validation.criticalCount;

    dom.statTotal.textContent = total;
    dom.statSingle.textContent = singleCount;
    dom.statTf.textContent = tfCount;
    dom.tabBadgeCount.textContent = total;

    if (criticalCount > 0) {
      dom.statWarning.style.display = 'inline-flex';
      dom.statWarning.style.cursor = 'pointer';
      dom.statWarning.title = '點擊檢視待修正問題題目清單 (目前阻擋匯出中)';
      dom.statWarning.innerHTML = `⚠️ 待修正: <strong>${criticalCount}</strong> (阻擋中)`;
      dom.statWarning.onclick = () => {
        state.currentFilter = 'warning';
        dom.filterBtns.forEach(b => b.classList.toggle('active', b.dataset.filter === 'warning'));
        renderQuestionsList();
        switchTab('editor');
      };
    } else {
      dom.statWarning.style.display = 'none';
      dom.statWarning.onclick = null;
    }
  }

  // 儲存狀態至 LocalStorage
  function saveState() {
    try {
      localStorage.setItem('eeclass_quiz_draft', JSON.stringify(state.questions));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
    updateStats();
  }

  // 從 LocalStorage 載入草稿
  function loadState() {
    try {
      const saved = localStorage.getItem('eeclass_quiz_draft');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          state.questions = parsed;
          renderQuestionsList();
          updateStats();
          return true;
        }
      }
    } catch (e) {
      console.warn('LocalStorage load error:', e);
    }
    return false;
  }

  // 頁籤切換
  function switchTab(tabId) {
    state.activeTab = tabId;
    dom.tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    dom.tabContents.forEach(content => {
      content.classList.toggle('active', content.id === `tab-${tabId}`);
    });

    if (tabId === 'editor') {
      renderQuestionsList();
    }
  }

  // 開啟格式診斷報告彈窗
  function openDiagnosticsModal(title, subtitle, icon, issues) {
    if (!dom.modalOverlay) return;
    dom.modalTitle.textContent = title;
    dom.modalSubtitle.textContent = subtitle;
    dom.modalIconBadge.textContent = icon;

    const criticalCount = issues.filter(i => i.level === 'critical').length;
    const warningCount = issues.filter(i => i.level === 'warning').length;

    dom.diagCriticalChip.textContent = `🚫 ${criticalCount} 處嚴重阻擋錯誤`;
    dom.diagCriticalChip.style.display = criticalCount > 0 ? 'inline-block' : 'none';
    dom.diagWarningChip.textContent = `⚠️ ${warningCount} 處格式建議`;
    dom.diagWarningChip.style.display = warningCount > 0 ? 'inline-block' : 'none';

    dom.modalIssuesList.innerHTML = '';
    issues.forEach(issue => {
      const item = document.createElement('div');
      item.className = `diag-issue-item ${issue.level === 'warning' ? 'is-warning' : ''}`;
      item.innerHTML = `
        <div class="diag-issue-content">
          <div class="diag-issue-title-row">
            <span class="diag-level-badge ${issue.level}">${issue.level === 'critical' ? '🚫 阻擋項' : '⚠️ 格式建議'}</span>
            <span class="diag-issue-title">${escapeHtml(issue.title)}</span>
          </div>
          <p class="diag-issue-msg">${escapeHtml(issue.message)}</p>
          ${issue.suggestion ? `<p class="diag-issue-suggestion">💡 建議修正：${escapeHtml(issue.suggestion)}</p>` : ''}
        </div>
        ${issue.questionId ? `
          <button class="btn btn-primary btn-sm diag-fix-btn" data-jump-to="${issue.questionId}">
            🛠️ 立即修正
          </button>
        ` : ''}
      `;
      dom.modalIssuesList.appendChild(item);
    });

    // 綁定個別題目的「立即修正」按鈕
    dom.modalIssuesList.querySelectorAll('[data-jump-to]').forEach(btn => {
      btn.addEventListener('click', () => {
        const qId = btn.dataset.jumpTo;
        closeDiagnosticsModal();
        jumpToQuestion(qId);
      });
    });

    dom.modalOverlay.style.display = 'flex';
  }

  // 關閉格式診斷報告彈窗
  function closeDiagnosticsModal() {
    if (dom.modalOverlay) {
      dom.modalOverlay.style.display = 'none';
    }
  }

  // 平滑跳轉至特定題目卡片並醒目高亮
  function jumpToQuestion(qId) {
    switchTab('editor');
    state.currentFilter = 'all';
    dom.filterBtns.forEach(b => b.classList.toggle('active', b.dataset.filter === 'all'));
    renderQuestionsList();

    setTimeout(() => {
      const card = document.getElementById(`q-card-${qId}`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.style.boxShadow = '0 0 0 3px #f43f5e, 0 0 32px rgba(244, 63, 94, 0.45)';
        card.style.transition = 'box-shadow 0.3s ease';
        setTimeout(() => {
          card.style.boxShadow = '';
        }, 3200);
      }
    }, 150);
  }

  // 解析使用者輸入之文字並執行全方位格式檢核
  function handleParseInput() {
    const rawText = dom.rawInput.value;
    if (!rawText || !rawText.trim()) {
      showToast('請先貼上 AI 產生的題目文字！', 'error');
      return;
    }

    try {
      const parsed = QuizParser.parseQuizText(rawText);
      if (parsed.length === 0) {
        showToast('未能辨識出題目，請檢查格式或參考格式規範手冊！', 'error');
        openDiagnosticsModal(
          '🚫 未能辨識出任何有效題目',
          '系統在您貼上的文字中未能找到符合規範的題目。請確保每題皆有題號（例如 1.）與選項或答案。',
          '🚫',
          [{
            level: 'critical',
            questionIndex: 0,
            questionId: null,
            title: '未解析出有效題目結構',
            message: '輸入的文字格式未能符合「單選題」或「是非題」結構。',
            suggestion: '請點擊下方「📖 查閱格式規範手冊」查看合格格式範例，或點擊「📚 載入範例題」試用。'
          }]
        );
        return;
      }

      state.questions = parsed;
      saveState();
      renderQuestionsList();

      // 執行嚴格合規檢核
      const validation = QuizParser.validateQuestions(parsed, rawText);
      if (validation.criticalCount > 0) {
        switchTab('editor');
        openDiagnosticsModal(
          '⚠️ 題目格式檢核診斷報告',
          `已成功識別 ${parsed.length} 道題目，但檢測到 ${validation.criticalCount} 處格式不符 ee-Class 要求（目前已阻擋匯出），請盡速補全！`,
          '⚠️',
          validation.issues
        );
        showToast(`成功解析 ${parsed.length} 題，但有 ${validation.criticalCount} 題需補齊答案！`, 'error');
      } else {
        switchTab('editor');
        showToast(`🎉 成功解析 ${parsed.length} 道題目，100% 格式合規！`, 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('解析過程發生錯誤：' + err.message, 'error');
    }
  }

  // 載入預設範例
  function handleLoadSample() {
    dom.rawInput.value = SAMPLE_AI_TEXT;
    dom.charCount.textContent = `${SAMPLE_AI_TEXT.length} 字`;
    handleParseInput();
  }

  // 渲染題目列表
  function renderQuestionsList() {
    dom.questionsList.innerHTML = '';
    const query = state.searchQuery.trim().toLowerCase();

    // 篩選題目
    const filtered = state.questions.filter((q, idx) => {
      // 搜尋字串過濾
      if (query) {
        const matchStem = (q.stem || '').toLowerCase().includes(query);
        const matchExp = (q.explanation || '').toLowerCase().includes(query);
        const matchOpt = (q.options || []).some(opt => opt.toLowerCase().includes(query));
        if (!matchStem && !matchExp && !matchOpt) return false;
      }

      // 類型篩選
      if (state.currentFilter === 'single') return q.type === QuizParser.QuestionType.SINGLE_CHOICE;
      if (state.currentFilter === 'tf') return q.type === QuizParser.QuestionType.TRUE_FALSE;
      if (state.currentFilter === 'warning') {
        if (q.type === QuizParser.QuestionType.SINGLE_CHOICE) {
          return !q.answer || !q.options || q.options.length < 2;
        } else {
          return !q.answer;
        }
      }
      return true;
    });

    if (filtered.length === 0) {
      dom.emptyState.style.display = 'block';
      dom.questionsList.style.display = 'none';
      return;
    }

    dom.emptyState.style.display = 'none';
    dom.questionsList.style.display = 'flex';

    filtered.forEach((q, displayIdx) => {
      // 尋找原始陣列中的真正索引
      const realIndex = state.questions.findIndex(item => item.id === q.id);
      const card = createQuestionCard(q, realIndex);
      dom.questionsList.appendChild(card);
    });
  }

  // 建立單一題目卡片 DOM
  function createQuestionCard(q, index) {
    const card = document.createElement('div');
    const isSingle = q.type === QuizParser.QuestionType.SINGLE_CHOICE;
    const isTf = q.type === QuizParser.QuestionType.TRUE_FALSE;

    // 驗證警告
    let warningText = '';
    if (isSingle) {
      if (!q.answer) warningText = '未選取正確答案';
      else if (!q.options || q.options.length < 2) warningText = '選項少於 2 個';
    } else {
      if (!q.answer) warningText = '未選取正確答案 (是/否)';
    }

    card.className = `glass-panel question-card ${isTf ? 'type-tf' : ''} ${warningText ? 'has-warning' : ''}`;
    card.id = `q-card-${q.id}`;

    // 難易度選項
    const diffEasy = q.difficulty === 1 ? 'selected' : '';
    const diffMed = (q.difficulty === 2 || !q.difficulty) ? 'selected' : '';
    const diffHard = q.difficulty === 3 ? 'selected' : '';

    // 卡片頂部操作
    card.innerHTML = `
      <div class="question-card-header">
        <div class="card-header-left">
          <span class="q-index-badge">第 ${index + 1} 題</span>
          <select class="type-select" data-action="change-type" data-id="${q.id}">
            <option value="2" ${isSingle ? 'selected' : ''}>單選題</option>
            <option value="1" ${isTf ? 'selected' : ''}>是非題</option>
          </select>
          <select class="difficulty-select" data-action="change-diff" data-id="${q.id}">
            <option value="1" ${diffEasy}>容易</option>
            <option value="2" ${diffMed}>適中</option>
            <option value="3" ${diffHard}>困難</option>
          </select>
          ${warningText ? `<span class="q-warning-tag">⚠️ ${warningText}</span>` : ''}
        </div>
        <div class="card-header-right">
          <button class="btn btn-icon-only" title="向上移動" data-action="move-up" data-id="${q.id}">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>
          </button>
          <button class="btn btn-icon-only" title="向下移動" data-action="move-down" data-id="${q.id}">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
          </button>
          <button class="btn btn-icon-only" title="複製題目" data-action="duplicate" data-id="${q.id}">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
          </button>
          <button class="btn btn-icon-only btn-delete-q" title="刪除題目" data-action="delete" data-id="${q.id}" style="color: var(--accent-rose)">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
          </button>
        </div>
      </div>

      <!-- 題幹輸入框 -->
      <textarea class="q-stem-textarea" placeholder="請輸入題目內容..." data-action="update-stem" data-id="${q.id}">${escapeHtml(q.stem || '')}</textarea>

      <!-- 答案與選項區域 -->
      <div class="q-body-area">
        ${isSingle ? renderSingleChoiceBody(q) : renderTfBody(q)}
      </div>

      <!-- 詳解說明區 -->
      <div class="explanation-row">
        <div class="explanation-toggle-btn">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <span>題目解析 / 說明 (選填，匯入 ee-class 後可提供學生檢視)</span>
        </div>
        <textarea class="explanation-input" placeholder="輸入解析與說明..." data-action="update-exp" data-id="${q.id}">${escapeHtml(q.explanation || '')}</textarea>
      </div>
    `;

    return card;
  }

  // 渲染單選題選項區塊
  function renderSingleChoiceBody(q) {
    const options = Array.isArray(q.options) ? q.options : [];
    const correctIdx = parseInt(q.answer, 10); // 1-based

    let optionsHtml = '<div class="options-list">';
    options.forEach((optText, optIdx) => {
      const letter = String.fromCharCode(65 + optIdx);
      const isCorrect = (optIdx + 1) === correctIdx;
      optionsHtml += `
        <div class="option-row ${isCorrect ? 'is-correct' : ''}">
          <input type="radio" name="ans_radio_${q.id}" class="option-radio" title="設為正確答案" 
            ${isCorrect ? 'checked' : ''} data-action="set-choice-ans" data-id="${q.id}" data-opt-idx="${optIdx + 1}">
          <span class="option-label">${letter}.</span>
          <input type="text" class="option-input" value="${escapeHtml(optText)}" placeholder="選項 ${letter} 內容..."
            data-action="update-option" data-id="${q.id}" data-opt-idx="${optIdx}">
          <button type="button" class="btn-remove-opt" title="刪除此選項" data-action="delete-option" data-id="${q.id}" data-opt-idx="${optIdx}">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
      `;
    });
    optionsHtml += '</div>';

    // 新增選項按鈕
    optionsHtml += `
      <div class="add-option-btn-row">
        <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.8rem; padding: 0.35rem 0.75rem;" data-action="add-option" data-id="${q.id}">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
          新增選項
        </button>
      </div>
    `;

    return optionsHtml;
  }

  // 渲染是非題按鈕區塊
  function renderTfBody(q) {
    const isTrue = q.answer === 1;
    const isFalse = q.answer === 2;

    return `
      <div class="tf-buttons-container">
        <button type="button" class="tf-choice-btn ${isTrue ? 'selected-true' : ''}" data-action="set-tf-ans" data-id="${q.id}" data-val="1">
          <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke-width="2.5"></circle></svg>
          <span>是 (True / 正確)</span>
        </button>
        <button type="button" class="tf-choice-btn ${isFalse ? 'selected-false' : ''}" data-action="set-tf-ans" data-id="${q.id}" data-val="2">
          <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
          <span>否 (False / 錯誤)</span>
        </button>
      </div>
    `;
  }

  // HTML 特殊字元跳脫
  function escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // 全域委派事件處理 (題目列表互動)
  dom.questionsList.addEventListener('input', (e) => {
    const target = e.target;
    const action = target.dataset.action;
    const qId = target.dataset.id;
    if (!action || !qId) return;

    const q = state.questions.find(item => item.id === qId);
    if (!q) return;

    if (action === 'update-stem') {
      q.stem = target.value;
      saveState();
    } else if (action === 'update-exp') {
      q.explanation = target.value;
      saveState();
    } else if (action === 'update-option') {
      const optIdx = parseInt(target.dataset.optIdx, 10);
      if (q.options && q.options[optIdx] !== undefined) {
        q.options[optIdx] = target.value;
        saveState();
      }
    }
  });

  dom.questionsList.addEventListener('change', (e) => {
    const target = e.target;
    const action = target.dataset.action;
    const qId = target.dataset.id;
    if (!action || !qId) return;

    const q = state.questions.find(item => item.id === qId);
    if (!q) return;

    if (action === 'change-type') {
      const newType = parseInt(target.value, 10);
      q.type = newType;
      if (newType === QuizParser.QuestionType.SINGLE_CHOICE) {
        if (!q.options || q.options.length === 0) {
          q.options = ['選項 A', '選項 B', '選項 C', '選項 D'];
        }
        q.answer = 1;
      } else {
        q.answer = 1; // 預設「是」
      }
      saveState();
      renderQuestionsList();
    } else if (action === 'change-diff') {
      q.difficulty = parseInt(target.value, 10);
      saveState();
    } else if (action === 'set-choice-ans') {
      q.answer = parseInt(target.dataset.optIdx, 10);
      saveState();
      renderQuestionsList();
    }
  });

  dom.questionsList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const qId = btn.dataset.id;
    const index = state.questions.findIndex(item => item.id === qId);
    if (index === -1 && action !== 'add-new-root') return;

    const q = state.questions[index];

    if (action === 'set-tf-ans') {
      q.answer = parseInt(btn.dataset.val, 10);
      saveState();
      renderQuestionsList();
    } else if (action === 'add-option') {
      if (!Array.isArray(q.options)) q.options = [];
      q.options.push(`選項 ${String.fromCharCode(65 + q.options.length)}`);
      saveState();
      renderQuestionsList();
    } else if (action === 'delete-option') {
      const optIdx = parseInt(btn.dataset.optIdx, 10);
      if (q.options && q.options.length > 2) {
        q.options.splice(optIdx, 1);
        if (q.answer > q.options.length) {
          q.answer = q.options.length;
        }
        saveState();
        renderQuestionsList();
      } else {
        showToast('單選題至少需保留 2 個選項！', 'error');
      }
    } else if (action === 'delete') {
      state.questions.splice(index, 1);
      saveState();
      renderQuestionsList();
      showToast('已刪除題目', 'info');
    } else if (action === 'duplicate') {
      const clone = JSON.parse(JSON.stringify(q));
      clone.id = 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      clone.stem += ' (複製)';
      state.questions.splice(index + 1, 0, clone);
      saveState();
      renderQuestionsList();
      showToast('已複製題目', 'success');
    } else if (action === 'move-up') {
      if (index > 0) {
        const temp = state.questions[index - 1];
        state.questions[index - 1] = state.questions[index];
        state.questions[index] = temp;
        saveState();
        renderQuestionsList();
      }
    } else if (action === 'move-down') {
      if (index < state.questions.length - 1) {
        const temp = state.questions[index + 1];
        state.questions[index + 1] = state.questions[index];
        state.questions[index] = temp;
        saveState();
        renderQuestionsList();
      }
    }
  });

  // 新增全新題目
  dom.btnAddQuestion.addEventListener('click', () => {
    const newQ = {
      id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      type: QuizParser.QuestionType.SINGLE_CHOICE,
      stem: '請輸入新的題目內容...',
      options: ['選項 A', '選項 B', '選項 C', '選項 D'],
      answer: 1,
      explanation: '',
      difficulty: 2
    };
    state.questions.push(newQ);
    saveState();
    renderQuestionsList();
    showToast('已新增一道題目！', 'success');

    // 捲動至最底部
    setTimeout(() => {
      const newCard = document.getElementById(`q-card-${newQ.id}`);
      if (newCard) newCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  });

  // 篩選標籤點擊
  dom.filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      dom.filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentFilter = btn.dataset.filter;
      renderQuestionsList();
    });
  });

  // 搜尋關鍵字
  dom.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderQuestionsList();
  });

  // 嚴格檢核防線：阻擋任何不合規的題目匯出，保證 ee-Class 100% 成功
  function verifyStrictCompliance(exportType) {
    if (state.questions.length === 0) {
      showToast('目前題庫沒有題目可匯出！', 'error');
      return false;
    }

    const validation = QuizParser.validateQuestions(state.questions);
    if (validation.criticalCount > 0) {
      // 嚴格阻擋！彈出阻擋視窗與清單，不提供「強制匯出」漏洞
      openDiagnosticsModal(
        '🚫 格式未達標，已依嚴格防呆機制阻擋匯出',
        `為確保匯入 ee-Class 100% 成功且自動批改無誤，系統已嚴格阻擋下載。發現有 ${validation.criticalCount} 處嚴重格式錯誤（如缺答案、選項不足等），請修正後再匯出！`,
        '🚫',
        validation.issues.filter(i => i.level === 'critical')
      );
      showToast(`🚫 匯出已阻擋：請修正 ${validation.criticalCount} 處格式錯誤後再試！`, 'error');
      return false;
    }

    return true;
  }

  // 匯出 ee-class CSV
  dom.btnExportCsv.addEventListener('click', () => {
    if (!verifyStrictCompliance('csv')) return;

    try {
      const csvData = QuizExporter.generateEeclassCsv(state.questions);
      const filename = `eeClass_測驗題目_${getFormattedDate()}_${state.questions.length}題.csv`;
      QuizExporter.triggerDownload(csvData, filename, 'text/csv;charset=utf-8');
      showToast(`🎉 100% 格式規範檢核通過！已成功下載 ${filename}`, 'success');
    } catch (err) {
      console.error(err);
      showToast('匯出 CSV 失敗：' + err.message, 'error');
    }
  });

  // 匯出 GIFT 格式
  dom.btnExportGift.addEventListener('click', () => {
    if (!verifyStrictCompliance('gift')) return;

    try {
      const giftData = QuizExporter.generateGift(state.questions);
      const filename = `eeClass_測驗題目_${getFormattedDate()}_${state.questions.length}題.gift`;
      QuizExporter.triggerDownload(giftData, filename, 'text/plain;charset=utf-8');
      showToast(`🎉 100% 格式規範檢核通過！已成功下載 GIFT 格式 ${filename}`, 'success');
    } catch (err) {
      console.error(err);
      showToast('匯出 GIFT 失敗：' + err.message, 'error');
    }
  });

  // 日期格式化 YYYYMMDD_HHmm
  function getFormattedDate() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  }

  // 複製按鈕 (用於 Prompt 模板、手冊範例等)
  document.querySelectorAll('[data-copy-target]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.copyTarget;
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        const text = targetEl.textContent || targetEl.innerText;
        navigator.clipboard.writeText(text).then(() => {
          showToast('已複製標準格式範例到剪貼簿！可直接貼上使用', 'success');
        }).catch(err => {
          showToast('複製失敗：' + err, 'error');
        });
      }
    });
  });

  // 頁籤按鈕綁定
  dom.tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });

  // 輸入區捷徑按鈕前往手冊
  if (dom.btnGotoManual) {
    dom.btnGotoManual.addEventListener('click', () => switchTab('manual'));
  }
  if (dom.btnGuideToManual) {
    dom.btnGuideToManual.addEventListener('click', () => switchTab('manual'));
  }

  // 診斷彈窗按鈕綁定
  if (dom.modalCloseBtn) {
    dom.modalCloseBtn.addEventListener('click', closeDiagnosticsModal);
  }
  if (dom.modalBtnDismiss) {
    dom.modalBtnDismiss.addEventListener('click', closeDiagnosticsModal);
  }
  if (dom.modalOverlay) {
    dom.modalOverlay.addEventListener('click', (e) => {
      if (e.target === dom.modalOverlay) closeDiagnosticsModal();
    });
  }
  if (dom.modalBtnFix) {
    dom.modalBtnFix.addEventListener('click', () => {
      closeDiagnosticsModal();
      state.currentFilter = 'warning';
      dom.filterBtns.forEach(b => b.classList.toggle('active', b.dataset.filter === 'warning'));
      renderQuestionsList();
      switchTab('editor');
      showToast('已為您篩選出所有待修正題目，請直接在卡片上點選答案！', 'info');
    });
  }
  if (dom.modalBtnManual) {
    dom.modalBtnManual.addEventListener('click', () => {
      closeDiagnosticsModal();
      switchTab('manual');
    });
  }

  // 輸入框字數監聽
  dom.rawInput.addEventListener('input', () => {
    dom.charCount.textContent = `${dom.rawInput.value.length} 字`;
  });

  // 清空輸入
  dom.btnClearInput.addEventListener('click', () => {
    if (dom.rawInput.value && confirm('確定要清空輸入框嗎？')) {
      dom.rawInput.value = '';
      dom.charCount.textContent = '0 字';
    }
  });

  // 按鈕事件綁定
  dom.btnParse.addEventListener('click', handleParseInput);
  dom.btnLoadSample.addEventListener('click', handleLoadSample);
  dom.btnThemeToggle.addEventListener('click', toggleTheme);

  // 初始化草稿或範例
  initTheme();
  const hasDraft = loadState();
  if (!hasDraft) {
    dom.rawInput.value = SAMPLE_AI_TEXT;
    dom.charCount.textContent = `${SAMPLE_AI_TEXT.length} 字`;
    handleParseInput();
  }
});
