/**
 * ee-Class 題目解析器 (ee-Class Quiz Parser)
 * 支援單選題 (Single Choice) 與是非題 (True/False)
 * 能自動處理 ChatGPT / Claude / Gemini / DeepSeek 常見輸出格式
 */

(function (global) {
  'use strict';

  const QuestionType = {
    TRUE_FALSE: 1,     // 是非題 (ee-class 題型代碼: 1)
    SINGLE_CHOICE: 2,  // 單選題 (ee-class 題型代碼: 2)
    MULTI_CHOICE: 3    // 複選題 (ee-class 題型代碼: 3)
  };

  const Difficulty = {
    EASY: 1,
    MEDIUM: 2,
    HARD: 3
  };

  /**
   * 正規化字串：將全形英數字轉換為半形，移除 markdown 標記
   */
  function normalizeInput(text) {
    if (!text) return '';
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // 全形英文字母與數字轉半形
      .replace(/[\uFF01-\uFF5E]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
      .replace(/　/g, ' ') // 全形空白轉半形
      .replace(/\*\*/g, '') // 移除 markdown 粗體
      .replace(/`/g, '');
  }

  /**
   * 清理文字，移除前後空白
   */
  function cleanText(text) {
    if (!text) return '';
    return text.trim();
  }

  /**
   * 解析是非題答案
   * 回傳: 1 (是 / O / True) 或 2 (否 / X / False) 或 null
   */
  function parseTfAnswer(str) {
    if (!str) return null;
    const s = str.trim().toUpperCase();
    // 符合「是 / 正確 / O / T / TRUE / 對 / ✔ / V / 1」
    if (/^(1|O|○|⭕|T|TRUE|是|對|正確|YES|V|✔)$/i.test(s) || /^[（(][O○⭕T是丵對V✔][）)]$/.test(s)) {
      return 1;
    }
    // 符合「否 / 錯誤 / X / F / FALSE / 錯 / ╳ / ✕ / ✘ / 2」
    if (/^(2|X|╳|✕|✘|F|FALSE|否|錯|錯誤|NO)$/i.test(s) || /^[（(][X╳✕✘F否錯][）)]$/.test(s)) {
      return 2;
    }
    // 包含字眼檢查
    if (/(正確|答案[：:\s]*[O○⭕T是丵對]|為[是丵對]|選[是丵對])/i.test(s)) return 1;
    if (/(錯誤|不正確|答案[：:\s]*[X╳✕✘F否錯]|為[否錯]|選[否錯])/i.test(s)) return 2;
    return null;
  }

  /**
   * 解析選擇題答案
   * 回傳選項索引 1-based (A->1, B->2, C->3, D->4...)
   */
  function parseChoiceAnswer(str) {
    if (!str) return null;
    const clean = str.trim().toUpperCase();
    const match = clean.match(/([A-Z]|\d+)/);
    if (!match) return null;
    const val = match[1];
    if (/^[A-Z]$/.test(val)) {
      return val.charCodeAt(0) - 64; // A=1, B=2, C=3, D=4...
    }
    const num = parseInt(val, 10);
    return isNaN(num) ? null : num;
  }

  /**
   * 解析難易度
   */
  function parseDifficulty(str) {
    if (!str) return Difficulty.MEDIUM;
    const s = str.toString().trim();
    if (/1|易|容易|簡單|easy/i.test(s)) return Difficulty.EASY;
    if (/3|難|困難|高|hard/i.test(s)) return Difficulty.HARD;
    return Difficulty.MEDIUM;
  }

  /**
   * 核心解析函數：將整段文字切塊並解析成題目物件陣列
   */
  function parseQuizText(rawText, defaultSectionType = null) {
    if (!rawText || !rawText.trim()) return [];

    const normalized = normalizeInput(rawText);
    const lines = normalized.split('\n');
    const questions = [];

    let currentSectionType = defaultSectionType;
    let rawBlocks = [];
    let currentBlock = [];

    // 檢查某行是否為大章節標題
    function checkSectionHeader(line) {
      const trimmed = line.trim();
      if (/^(#+\s*)?[一二三四五六七八九十0-9]+[、.．\s]+(是非題|判斷題|對錯題)/i.test(trimmed) ||
          /^【?(是非題|判斷題|對錯題)】?$/i.test(trimmed)) {
        return QuestionType.TRUE_FALSE;
      }
      if (/^(#+\s*)?[一二三四五六七八九十0-9]+[、.．\s]+(單選題|選擇題)/i.test(trimmed) ||
          /^【?(單選題|選擇題)】?$/i.test(trimmed)) {
        return QuestionType.SINGLE_CHOICE;
      }
      return null;
    }

    // 檢查某行是否為新題目的開頭
    function isQuestionStart(line) {
      const trimmed = line.trim();
      // 避免把選項 (A), (B) 或 (1), (2), (3), (4) 誤認為題目開頭
      if (/^[（(\[]?[A-Ha-h][）)\]][.、．\s]/.test(trimmed)) return false;
      if (/^[A-Ha-h][.、．\s]/.test(trimmed)) return false;
      if (/^[（(\[]\s*[1-6]\s*[）\]]/.test(trimmed)) return false;
      if (/^(Q\s*\d+|第\s*\d+\s*題|\d+)[.、．:：\s]/i.test(trimmed)) return true;
      if (/^【\s*\d+\s*】/.test(trimmed)) return true;
      if (/^[（(]\s*\d+\s*[）)]\s*/.test(trimmed)) return true;
      if (/^\[(單選|是非|選擇)\]/i.test(trimmed)) return true;
      return false;
    }

    // 先分塊
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      const newSec = checkSectionHeader(trimmed);
      if (newSec !== null) {
        if (currentBlock.length > 0) {
          rawBlocks.push({ sectionType: currentSectionType, lines: currentBlock });
          currentBlock = [];
        }
        currentSectionType = newSec;
        continue;
      }

      if (isQuestionStart(trimmed)) {
        if (currentBlock.length > 0) {
          rawBlocks.push({ sectionType: currentSectionType, lines: currentBlock });
          currentBlock = [];
        }
      }

      if (trimmed || currentBlock.length > 0) {
        currentBlock.push(line);
      }
    }

    if (currentBlock.length > 0) {
      rawBlocks.push({ sectionType: currentSectionType, lines: currentBlock });
    }

    // 逐塊解析題目
    rawBlocks.forEach((block, blockIndex) => {
      const q = parseSingleBlock(block.lines, block.sectionType, blockIndex + 1);
      if (q) questions.push(q);
    });

    return questions;
  }

  /**
   * 解析單一題目區塊
   */
  function parseSingleBlock(lines, sectionType, defaultIndex) {
    if (!lines || lines.length === 0) return null;

    let questionText = '';
    let options = [];
    let answerRaw = '';
    let explanation = '';
    let difficulty = Difficulty.MEDIUM;
    let explicitType = sectionType;

    // 題目開頭去除題號模式
    const leadNumberRegex = /^(Q\s*\d+|第\s*\d+\s*題|\d+|【\s*\d+\s*】|[（(]\s*\d+\s*[）)])[.、．:：\s]*/i;
    // 選項模式: A. / (A) / [A] / A、
    const optionPrefixRegex = /^[（(\[]?([A-Za-z]|\d+)[）)\]][.、．\s]*|^([A-Za-z])[.、．\s]+/;

    let state = 'QUESTION'; // 'QUESTION', 'OPTIONS', 'ANSWER', 'EXPLANATION'

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line) continue;

      // 檢查是否標註題型標籤，例如 [單選]、[是非]
      if (/^\[(單選|選擇)\]/i.test(line) || /^【(單選|選擇)】/i.test(line)) {
        explicitType = QuestionType.SINGLE_CHOICE;
        line = line.replace(/^(\[(單選|選擇)\]|【(單選|選擇)】)\s*/i, '');
      } else if (/^\[(是非|判斷)\]/i.test(line) || /^【(是非|判斷)】/i.test(line)) {
        explicitType = QuestionType.TRUE_FALSE;
        line = line.replace(/^(\[(是非|判斷)\]|【(是非|判斷)】)\s*/i, '');
      }

      // 檢查難易度行
      const diffMatch = line.match(/(?:難易度|難度|Difficulty)[：:\s]*([^\n,，]+)/i);
      if (diffMatch) {
        difficulty = parseDifficulty(diffMatch[1]);
        line = line.replace(/(?:難易度|難度|Difficulty)[：:\s]*[^\n,，]+/i, '').trim();
        if (!line) continue;
      }

      // 檢查答案行
      const ansMatch = line.match(/^(?:正確答案|答案|Ans|Answer|Key)[：:\s]*(.+)$/i) ||
                       line.match(/^【(?:正確答案|答案|Ans)】\s*(.+)$/i);
      if (ansMatch) {
        state = 'ANSWER';
        let remaining = ansMatch[1].trim();

        // 答案可能跟解析在同一行: 例如 "答案：A 解析：因為..." 或 "答案：O (解析...)"
        const inlineExpMatch = remaining.match(/^(.*?)(?:[；;，,]\s*|\s+)(?:解析|詳解|說明|解說|Rationale|Explanation)[：:\s]*(.*)$/i);
        if (inlineExpMatch) {
          answerRaw = inlineExpMatch[1].trim();
          explanation = inlineExpMatch[2].trim();
          state = 'EXPLANATION';
        } else {
          answerRaw = remaining;
        }
        continue;
      }

      // 檢查解析行
      const expMatch = line.match(/^(?:解析|詳解|說明|解說|Rationale|Explanation)[：:\s]*(.*)$/i) ||
                       line.match(/^【(?:解析|詳解|說明|解說)】\s*(.*)$/i);
      if (expMatch) {
        state = 'EXPLANATION';
        explanation = (explanation ? explanation + '\n' : '') + expMatch[1].trim();
        continue;
      }

      if (state === 'EXPLANATION') {
        explanation = (explanation ? explanation + '\n' : '') + line;
        continue;
      }

      // 檢查是否為單行內包含多個選項: 例如 "題目 (A) 蘋果 (B) 香蕉 (C) 芭樂 (D) 西瓜"
      const inlineData = splitInlineOptions(line);
      if (inlineData && inlineData.options.length >= 2) {
        if (state === 'QUESTION' && inlineData.prefix) {
          const cleanPrefix = inlineData.prefix.replace(leadNumberRegex, '').trim();
          if (cleanPrefix) {
            questionText = questionText ? (questionText + '\n' + cleanPrefix) : cleanPrefix;
          }
        }
        state = 'OPTIONS';
        inlineData.options.forEach(opt => options.push(opt));
        continue;
      }

      // 檢查是否為單獨選項開頭: A. 或 (A) 或 A、 或 (1), (2)...
      // 亦可能前面有題幹: 例如 "1. 題目 (A) 第一個選項"
      const optMatch = line.match(/(?:^|(.*?)\s+)(?:[（(\[]([A-Ha-h1-6])[）)\]]|([A-Ha-h])[.、．])\s*(.*)$/);
      if (optMatch) {
        const prefix = (optMatch[1] || '').trim();
        let rawLetter = (optMatch[2] || optMatch[3]).toUpperCase();
        if (/^[1-6]$/.test(rawLetter)) {
          rawLetter = String.fromCharCode(64 + parseInt(rawLetter, 10)); // 1->A, 2->B...
        }
        const optText = (optMatch[4] || '').trim();

        if (state === 'QUESTION' && prefix) {
          const cleanPrefix = prefix.replace(leadNumberRegex, '').trim();
          if (cleanPrefix) {
            questionText = questionText ? (questionText + '\n' + cleanPrefix) : cleanPrefix;
          }
        }

        state = 'OPTIONS';
        options.push({ letter: rawLetter, text: optText });
        continue;
      }

      // 若處於 OPTIONS 狀態且此行不是答案/解析，可能是選項換行延續
      if (state === 'OPTIONS' && options.length > 0) {
        options[options.length - 1].text += ' ' + line;
        continue;
      }

      // 否則視為題目文字
      if (state === 'QUESTION') {
        if (!questionText) {
          // 第一行去掉開頭題號
          let cleanStem = line.replace(leadNumberRegex, '').trim();

          // 檢查是非題前綴或後綴型答案: 如 "(O) 細菌有細胞壁" 或 "細菌有細胞壁 (X)"
          const leadTf = cleanStem.match(/^[（(]([O○⭕TX╳✕✘F是丵否對錯])[）)][\s、.．]*(.*)$/i);
          if (leadTf) {
            explicitType = QuestionType.TRUE_FALSE;
            if (!answerRaw) answerRaw = leadTf[1];
            cleanStem = leadTf[2].trim();
          }

          const tailTf = cleanStem.match(/^(.*?)\s*[（(]([O○⭕TX╳✕✘F是丵否對錯])[）)]\s*$/i);
          if (tailTf && !answerRaw) {
            explicitType = QuestionType.TRUE_FALSE;
            answerRaw = tailTf[2];
            cleanStem = tailTf[1].trim();
          }

          questionText = cleanStem;
        } else {
          questionText += '\n' + line;
        }
      }
    }

    questionText = cleanText(questionText);
    explanation = cleanText(explanation);

    // 檢查題目文字結尾是否帶有答案括號，例如: "細菌屬於原核生物。（對）"
    const inlineAnsMatch = questionText.match(/^(.*?)[（(]\s*([A-Da-dO○⭕TX╳✕✘F是丵否對錯])\s*[）)]\s*$/i);
    if (inlineAnsMatch && !answerRaw) {
      questionText = inlineAnsMatch[1].trim();
      answerRaw = inlineAnsMatch[2].trim();
    }

    // 判斷題型
    let type = explicitType;
    if (!type) {
      if (options.length >= 2) {
        type = QuestionType.SINGLE_CHOICE;
      } else if (parseTfAnswer(answerRaw) !== null || /^(是|否|O|X|True|False)$/i.test(answerRaw)) {
        type = QuestionType.TRUE_FALSE;
      } else {
        // 預設若有選項算選擇題，否則若無選項當是非題
        type = options.length > 0 ? QuestionType.SINGLE_CHOICE : QuestionType.TRUE_FALSE;
      }
    }

    // 處理答案代碼
    let finalAnswer = null;
    let answerDisplay = '';

    if (type === QuestionType.TRUE_FALSE) {
      const tfCode = parseTfAnswer(answerRaw);
      if (tfCode !== null) {
        finalAnswer = tfCode; // 1: 是, 2: 否
        answerDisplay = tfCode === 1 ? 'O (是)' : 'X (否)';
      } else {
        answerDisplay = answerRaw || '未標註';
      }
    } else {
      // 單選題
      const choiceIdx = parseChoiceAnswer(answerRaw);
      if (choiceIdx !== null && choiceIdx >= 1) {
        finalAnswer = choiceIdx;
        const letter = String.fromCharCode(64 + choiceIdx);
        answerDisplay = `${letter} (選項 ${choiceIdx})`;
      } else {
        answerDisplay = answerRaw || '未標註';
      }
    }

    // 清理選項陣列格式
    const formattedOptions = options.map((opt, idx) => {
      return typeof opt === 'string' ? opt.trim() : (opt.text || '').trim();
    });

    if (!questionText && formattedOptions.length === 0) {
      return null;
    }

    return {
      id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      index: defaultIndex,
      type: type,
      stem: questionText || `(第 ${defaultIndex} 題未填題目)`,
      options: formattedOptions,
      answer: finalAnswer,
      rawAnswer: answerRaw,
      answerDisplay: answerDisplay,
      explanation: explanation,
      difficulty: difficulty
    };
  }

  /**
   * 輔助函數: 拆解一行內含多個選項的情況
   * 例如: (A) 10 (B) 20 (C) 30 (D) 40
   */
  function splitInlineOptions(line) {
    const regex = /(?:^|\s+)(?:[（(\[]([A-Ha-h])[）)\]]|([A-Ha-h])[.、．])\s*/g;
    let match;
    const splits = [];

    while ((match = regex.exec(line)) !== null) {
      splits.push({
        letter: (match[1] || match[2]).toUpperCase(),
        index: match.index,
        length: match[0].length
      });
    }

    if (splits.length < 2) return null;

    const result = [];
    for (let i = 0; i < splits.length; i++) {
      const cur = splits[i];
      const start = cur.index + cur.length;
      const end = (i + 1 < splits.length) ? splits[i + 1].index : line.length;
      const text = line.substring(start, end).trim();
      result.push({
        letter: cur.letter,
        text: text
      });
    }
    const prefix = splits[0].index > 0 ? line.substring(0, splits[0].index).trim() : '';
    return {
      prefix: prefix,
      options: result
    };
  }

  /**
   * 嚴格格式合規性驗證函數 (Strict Quiz Validator)
   * 依據 ee-Class 官方匯入規範進行全方位檢核，確保匯入零錯誤
   * 回傳: { isValid: boolean, criticalCount: number, warningCount: number, totalIssues: number, issues: Array }
   */
  function validateQuestions(questions, rawText = '') {
    const issues = [];
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      issues.push({
        level: 'critical',
        questionIndex: 0,
        questionId: null,
        code: 'NO_QUESTIONS',
        title: '未解析出任何題目',
        message: '輸入內容未能識別出符合規範的題目。請確認每題皆有題號（例如 1.）與選項或答案。',
        suggestion: '請參考「匯入格式規範手冊」或點擊「📚 載入範例題」查看標準排版。'
      });
      return {
        isValid: false,
        criticalCount: 1,
        warningCount: 0,
        totalIssues: 1,
        issues: issues
      };
    }

    questions.forEach((q, idx) => {
      const qNum = idx + 1;
      const isSingle = q.type === QuestionType.SINGLE_CHOICE;
      const isTf = q.type === QuestionType.TRUE_FALSE;

      // 1. 檢查題幹 (Critical)
      const cleanStem = (q.stem || '').trim();
      if (!cleanStem || cleanStem.startsWith(`(第 ${q.index || qNum} 題未填`)) {
        issues.push({
          level: 'critical',
          questionIndex: qNum,
          questionId: q.id,
          code: 'EMPTY_STEM',
          title: `第 ${qNum} 題：題幹內容為空`,
          message: '題目未填寫題幹描述，ee-Class 測驗系統無法匯入無題幹的題目。',
          suggestion: '請輸入完整的題目敘述。'
        });
      }

      // 2. 檢查單選題規格 (Critical)
      if (isSingle) {
        // 選項數量檢查
        if (!q.options || !Array.isArray(q.options) || q.options.length < 2) {
          const optCount = q.options ? q.options.length : 0;
          issues.push({
            level: 'critical',
            questionIndex: qNum,
            questionId: q.id,
            code: 'INSUFFICIENT_OPTIONS',
            title: `第 ${qNum} 題：單選題選項不足 (至少需 2 個)`,
            message: `單選題必須至少包含 2 個選項（建議 4 個），目前僅解析出 ${optCount} 個選項。`,
            suggestion: '請補齊 (A)、(B) 等選項內容，並注意選項開頭格式為 (A) 或 A.'
          });
        } else {
          // 選項空白檢查
          q.options.forEach((opt, oIdx) => {
            if (!opt || !opt.trim()) {
              issues.push({
                level: 'critical',
                questionIndex: qNum,
                questionId: q.id,
                code: 'EMPTY_OPTION',
                title: `第 ${qNum} 題：選項 ${String.fromCharCode(65 + oIdx)} 內容空白`,
                message: `第 ${String.fromCharCode(65 + oIdx)} 個選項未填寫內容。`,
                suggestion: '請補全該選項內容或移除空白選項。'
              });
            }
          });

          // 選項上限提示 (ee-Class 最多支援 20 個選項)
          if (q.options.length > 20) {
            issues.push({
              level: 'warning',
              questionIndex: qNum,
              questionId: q.id,
              code: 'TOO_MANY_OPTIONS',
              title: `第 ${qNum} 題：選項數量超過 20 個`,
              message: `ee-Class 官方規格單選題上限為 20 個選項，目前有 ${q.options.length} 個。`,
              suggestion: '建議將選項精簡至 20 個以內。'
            });
          }
        }

        // 單選題答案檢查 (Critical)
        if (q.answer === null || q.answer === undefined || q.answer === '') {
          issues.push({
            level: 'critical',
            questionIndex: qNum,
            questionId: q.id,
            code: 'MISSING_ANSWER',
            title: `第 ${qNum} 題：單選題尚未指定正確答案`,
            message: '題目未標註正確答案（例如：答案：A），這會導致學生測驗時系統無法批改。',
            suggestion: '請於題目下方加上「答案：A/B/C/D」或於預覽卡片直接點選正確答案圓鈕。'
          });
        } else {
          const ansNum = Number(q.answer);
          if (isNaN(ansNum) || ansNum < 1 || (q.options && ansNum > q.options.length)) {
            const letter = ansNum >= 1 && ansNum <= 26 ? String.fromCharCode(64 + ansNum) : ansNum;
            issues.push({
              level: 'critical',
              questionIndex: qNum,
              questionId: q.id,
              code: 'ANSWER_OUT_OF_RANGE',
              title: `第 ${qNum} 題：答案超出選項範圍`,
              message: `指定答案為「${letter}」(第 ${ansNum} 項)，但本題選項僅有 ${q.options ? q.options.length : 0} 個。`,
              suggestion: '請確認答案指定字母與選項總數一致。'
            });
          }
        }
      }

      // 3. 檢查是非題規格 (Critical)
      if (isTf) {
        if (q.answer === null || q.answer === undefined || q.answer === '') {
          issues.push({
            level: 'critical',
            questionIndex: qNum,
            questionId: q.id,
            code: 'MISSING_ANSWER',
            title: `第 ${qNum} 題：是非題未指定答案`,
            message: '是非題未標註答案是 O 或 X（是/否），將無法在 ee-Class 建立評分標準。',
            suggestion: '請於題目下方加上「答案：O」或於卡片直接點選 [⭕ 是] / [❌ 否]。'
          });
        } else if (q.answer !== 1 && q.answer !== 2) {
          issues.push({
            level: 'critical',
            questionIndex: qNum,
            questionId: q.id,
            code: 'INVALID_TF_ANSWER',
            title: `第 ${qNum} 題：是非題答案非合法代碼`,
            message: `是非題答案為「${q.rawAnswer || q.answer}」，必須為合法的是/否 (O/X/True/False)。`,
            suggestion: '請修正答案標記為「答案：O」或「答案：X」。'
          });
        }
      }

      // 4. 解析填寫提醒 (Warning)
      if (!q.explanation || !q.explanation.trim()) {
        issues.push({
          level: 'warning',
          questionIndex: qNum,
          questionId: q.id,
          code: 'MISSING_EXPLANATION',
          title: `第 ${qNum} 題：未填寫解析說明`,
          message: '本題未附詳解。雖不影響匯入，但強烈建議提供詳細解析，便於學生測驗後檢閱與複習。',
          suggestion: '可在題目下方加上「解析：說明原因...」。'
        });
      }
    });

    const criticalCount = issues.filter(i => i.level === 'critical').length;
    const warningCount = issues.filter(i => i.level === 'warning').length;

    return {
      isValid: criticalCount === 0,
      criticalCount: criticalCount,
      warningCount: warningCount,
      totalIssues: issues.length,
      issues: issues
    };
  }

  // 導出模組
  global.QuizParser = {
    QuestionType,
    Difficulty,
    parseQuizText,
    parseSingleBlock,
    parseTfAnswer,
    parseChoiceAnswer,
    validateQuestions
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.QuizParser;
  }

})(typeof window !== 'undefined' ? window : globalThis);
