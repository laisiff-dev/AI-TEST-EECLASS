/**
 * ee-Class 智慧題目解析器 (ee-Class Quiz Parser) - Pro 2026
 * 整合 Tools_QB 題庫轉換架構，全面放大支援 5 大完整題型與題庫類別：
 * 1. 是非題 (True/False, 1=是, 2=否)
 * 2. 單選題 (Single Choice, 1..N)
 * 3. 複選題 (Multiple Choice, 多選以逗號相連 "1,2,4")
 * 4. 填充題 (Fill-in-the-blank, 題幹內嵌 [*答案*], 支援大小寫與順序選項)
 * 5. 問答題 / 簡答題 (Essay / Short Answer, 支援參考答案)
 * 
 * 支援「類別 (Category)」智慧抓取與多章節批次識別
 * 能自動處理 ChatGPT / Claude / Gemini / DeepSeek 常見輸出格式
 */

(function (global) {
  'use strict';

  const QuestionType = {
    TRUE_FALSE: 1,     // 是非題 (ee-class 題型代碼: 1)
    SINGLE_CHOICE: 2,  // 單選題 (ee-class 題型代碼: 2)
    MULTI_CHOICE: 3,   // 複選題 (ee-class 題型代碼: 3)
    FILL_IN: 4,        // 填充題 (ee-class 題型代碼: 4)
    ESSAY: 5           // 問答題 (ee-class 題型代碼: 5)
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
   * 解析單選題答案
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
   * 解析複選題答案
   * 例如: "(A)(B)(D)", "A, B, D", "ABD", "1,2,4"
   * 回傳逗號分隔字串: "1,2,4"
   */
  function parseMultiChoiceAnswer(str) {
    if (!str) return '';
    const clean = str.trim().toUpperCase();
    
    // 1. 抓取所有英文字母 A-T
    const letters = clean.match(/[A-T]/g);
    if (letters && letters.length > 0) {
      const nums = letters.map(ch => ch.charCodeAt(0) - 64);
      const unique = Array.from(new Set(nums)).sort((a, b) => a - b);
      return unique.join(',');
    }

    // 2. 若為純數字以逗號或空格分隔，如 "1, 2, 4" 或 "1 2 4"
    const numbers = clean.match(/\b([1-9]|1\d|20)\b/g);
    if (numbers && numbers.length > 0) {
      const nums = numbers.map(n => parseInt(n, 10));
      const unique = Array.from(new Set(nums)).sort((a, b) => a - b);
      return unique.join(',');
    }

    return '';
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
   * 智慧分割單行包含多個選項的文字
   * 例如: "(A) 蘋果 (B) 香蕉 (C) 芭樂 (D) 西瓜"
   */
  function splitInlineOptions(line) {
    if (!line) return null;
    // 找出所有 (A), (B), (C) 或 A. B. C.
    const pattern = /(?:^|\s+)(?:[（(\[]([A-Ha-h1-6])[）)\]]|([A-Ha-h])[.、．])\s*/g;
    const matches = [];
    let m;
    while ((m = pattern.exec(line)) !== null) {
      matches.push({
        index: m.index,
        length: m[0].length,
        letter: (m[1] || m[2]).toUpperCase()
      });
    }

    if (matches.length < 2) return null;

    const prefix = line.substring(0, matches[0].index).trim();
    const options = [];

    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const start = current.index + current.length;
      const end = (i + 1 < matches.length) ? matches[i + 1].index : line.length;
      const text = line.substring(start, end).trim();
      let rawLetter = current.letter;
      if (/^[1-6]$/.test(rawLetter)) {
        rawLetter = String.fromCharCode(64 + parseInt(rawLetter, 10));
      }
      options.push({ letter: rawLetter, text: text });
    }

    return { prefix, options };
  }

  /**
   * 輔助解析 CSV 行（支援引號逗號跳脫）
   */
  function parseCsvLine(line) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur);
    return result.map(s => s.trim().replace(/^"|"$/g, '').trim());
  }

  /**
   * 輔助解析解答表區塊（支援 CSV 兩欄/四欄或編號格式）
   */
  function parseAnswerTableBlock(tableLines) {
    const answers = {};
    for (const line of tableLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.includes('題號') || trimmed.includes('解答表')) continue;

      const cells = parseCsvLine(trimmed);
      let foundInCsv = false;
      for (let k = 0; k < cells.length; k += 2) {
        if (k + 1 < cells.length) {
          const qStr = cells[k].trim();
          const ansStr = cells[k + 1].trim();
          if (/^\d+$/.test(qStr)) {
            const m = ansStr.match(/^\s*([A-Da-dOX1-4])/);
            if (m) {
              answers[parseInt(qStr, 10)] = m[1].toUpperCase();
              foundInCsv = true;
            }
          }
        }
      }

      if (!foundInCsv) {
        const matches = trimmed.matchAll(/(?:^|[,\s])(\d+)[.、．:\s,]+"?([A-Da-dOX1-4])/g);
        for (const m of matches) {
          const qNum = parseInt(m[1], 10);
          if (!answers[qNum]) {
            answers[qNum] = m[2].toUpperCase();
          }
        }
      }
    }
    return answers;
  }

  /**
   * 自由格式題庫智慧規格化與重構函數 (Smart Format Normalizer)
   * 專門將非標準、自由排版題庫（如 SDGs 永續發展題庫、Word 考卷檔、無序號或併排選項）
   * 智慧重構為標準期待格式（一、是非題/二、單選題...，(A)...，答案：...，解析：...，[*答案*]）
   */
  function normalizeFreeformQuizText(rawText) {
    if (!rawText || !rawText.trim()) {
      return {
        normalizedText: '',
        detectedCategory: '',
        stats: { extractedAnswers: 0, splitOptions: 0, convertedBlanks: 0, cleanedHeaders: false, standardizedSections: 0 },
        summaryMessage: '無輸入文字'
      };
    }

    // 1. 基本字元半形化與清理
    let text = rawText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[\uFF01-\uFF5E]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
      .replace(/　/g, ' ')
      .replace(/\*\*/g, '')
      .replace(/`/g, '');

    const lines = text.split('\n');
    const outputLines = [];
    let detectedCategory = '';
    let cleanedHeaders = false;
    let extractedAnswers = 0;
    let splitOptions = 0;
    let convertedBlanks = 0;
    let standardizedSections = 0;

    let inIntro = true;
    let currentSectionType = null;
    let sectionQIndices = {}; // qNum -> index in outputLines

    let i = 0;
    while (i < lines.length) {
      let line = lines[i].trim();
      if (!line) {
        outputLines.push('');
        i++;
        continue;
      }

      // 1. 過濾試卷結尾雜訊或延伸建議
      if (/^(?:🌱\s*後續延伸建議|※?\s*備註|以上題目由|Note:|Hope this helps)/i.test(line)) {
        break;
      }

      // 2. 章節 / 類別標題識別（如 📘 2.1 SDGs介紹（15題）或 第2章 ...）
      const isChapterHeader = /^(?:[📘📗📕📙]+|(?:第[一二三四五六七八九十0-9]+[章單單元節])|(?:\d+\.\d+))\s*(.*)$/i.test(line);
      if (isChapterHeader && !/^\d+[.、．]/.test(line)) {
        inIntro = false;
        let cleanCat = line.replace(/^[📘📗📕📙\s]+|[（(]\d+題[）)]\s*$/g, '').trim();
        if (cleanCat.length >= 2 && !/^[一二三四五六七八九十0-9]+[、.．\s]+(?:單選|是非|選擇|複選|填|問答|解答)/.test(cleanCat)) {
          sectionQIndices = {}; // 重置章節題號索引
          if (!detectedCategory) detectedCategory = cleanCat;
          outputLines.push(`\n[類別：${cleanCat}]`);
          i++;
          continue;
        }
      }

      // 3. 過濾試卷資訊雜訊或 AI 說明前言
      if (inIntro) {
        if (/^(?:國立|私立|市立|縣立|臺灣|台灣|.*大學|.*學校|.*高中|.*學年度|.*學期|考試時間|測驗時間|時間|姓名|學號|座號|班級|得分|成績|教師|批改|※?\s*作答說明|第\s*\d+\s*頁).*$/i.test(line) ||
            /(?:已為您|以下為|題目如下|共計\s*\d+\s*題|來源資料|排除非關|聚焦於)/.test(line)) {
          cleanedHeaders = true;
          i++;
          continue;
        }
      }

      // 4. 考卷前置主旨識別（若在題前出現）
      const topicMatch = line.match(/(?:課程|測驗|題庫|考卷|目標)[：:\s]*(.*(?:SDGs|永續發展|環境|通識|基礎|生物|化學|工程|資訊|管理|概論).*)/i) ||
                         line.match(/(.*(?:SDGs|永續發展).*)/i);
      if (inIntro && topicMatch && !detectedCategory) {
        let cleanCat = topicMatch[1].replace(/(?:期末|期中|核心素養|測驗|題庫|考卷|試卷|考試|核心能力)/g, '').trim();
        cleanCat = cleanCat.replace(/^[：:\s]+|[：:\s]+$/g, '');
        if (cleanCat.length >= 2 && !/^(?:已為您|以下為)/.test(cleanCat)) {
          detectedCategory = cleanCat;
        }
      }

      // 4. 大題題型標頭識別與標準化
      const tfSecMatch = line.match(/^【?(?:第?[一二三四五六七八九十0-9]+[、.．\s]+)?(?:是非[判斷對錯]*題|判斷題|對錯題).*?】?$/i);
      if (tfSecMatch) {
        inIntro = false;
        currentSectionType = 'TF';
        standardizedSections++;
        outputLines.push('\n一、是非題');
        i++;
        continue;
      }

      const singleSecMatch = line.match(/^【?(?:第?[一二三四五六七八九十0-9]+[、.．\s]+)?(?:單選[測驗選擇]*題|單一選擇題|選擇題).*?】?$/i);
      if (singleSecMatch) {
        inIntro = false;
        currentSectionType = 'SINGLE';
        standardizedSections++;
        outputLines.push('\n二、單選題');
        i++;
        continue;
      }

      const multiSecMatch = line.match(/^【?(?:第?[一二三四五六七八九十0-9]+[、.．\s]+)?(?:複選[測驗多重]*題|多選題|多重選擇題).*?】?$/i);
      if (multiSecMatch) {
        inIntro = false;
        currentSectionType = 'MULTI';
        standardizedSections++;
        outputLines.push('\n三、複選題');
        i++;
        continue;
      }

      const fillSecMatch = line.match(/^【?(?:第?[一二三四五六七八九十0-9]+[、.．\s]+)?(?:填[充空]+題).*?】?$/i);
      if (fillSecMatch) {
        inIntro = false;
        currentSectionType = 'FILL';
        standardizedSections++;
        outputLines.push('\n四、填充題');
        i++;
        continue;
      }

      const essaySecMatch = line.match(/^【?(?:第?[一二三四五六七八九十0-9]+[、.．\s]+)?(?:問答題|簡答題|申論題|計算題).*?】?$/i);
      if (essaySecMatch) {
        inIntro = false;
        currentSectionType = 'ESSAY';
        standardizedSections++;
        outputLines.push('\n五、問答題');
        i++;
        continue;
      }


      // 6. 集中解答表識別（支援插入於卷中或卷末的 CSV/文字表格）
      const isAnsTableHeader = /^(?:【\s*(?:解答|參考解答|標準答案|全卷解答|Answer Key)\s*】|(?:解答|參考解答|標準答案|全卷解答|Answer Key)[：:\s]*|(?:[一二三四五六七八九十0-9]+[、.．\s]+)?(?:解答表|參考解答|標準答案|全卷解答|Answer Key).*)$/i.test(line);
      const isCsvAnsTable = (line.includes('題號') && line.includes('答案')) || /^\d+\s*,\s*\"?[A-Da-dOX1-4]/.test(line);

      if (isAnsTableHeader || isCsvAnsTable) {
        const tableLines = [];
        if (!isAnsTableHeader) tableLines.push(line);
        i++;
        while (i < lines.length) {
          const nextLine = lines[i].trim();
          if (!nextLine) {
            i++;
            continue;
          }
          if (nextLine.includes('題號') && nextLine.includes('答案')) {
            tableLines.push(nextLine);
            i++;
            continue;
          }
          if (/^\d+\s*,\s*\"?[A-Da-dOX1-4]/.test(nextLine) || /^\d+[.、．:\s]+[A-Da-dOX1-4]/.test(nextLine)) {
            tableLines.push(nextLine);
            i++;
          } else {
            break;
          }
        }

        const tableAnswers = parseAnswerTableBlock(tableLines);
        const inserts = [];

        for (const [qNumStr, ansVal] of Object.entries(tableAnswers)) {
          const qNum = parseInt(qNumStr, 10);
          if (sectionQIndices[qNum] !== undefined) {
            const qIdx = sectionQIndices[qNum];
            let insertPos = qIdx + 1;
            while (insertPos < outputLines.length) {
              const curL = outputLines[insertPos];
              if (/^\d+[.、．]/.test(curL) || curL.startsWith('[類別：') || curL.startsWith('\n')) {
                break;
              }
              insertPos++;
            }
            inserts.push({ pos: insertPos, line: `答案：${ansVal}` });
            extractedAnswers++;
          }
        }

        // 由後往前插入，避免影響前面行號
        inserts.sort((a, b) => b.pos - a.pos);
        for (const ins of inserts) {
          outputLines.splice(ins.pos, 0, ins.line);
        }

        continue;
      }

      // 7. 檢查是否為新題目開頭（包含題首帶答案模式）
      const leadAnsQMatch = line.match(/^[（(\[]\s*([A-Ha-hO○⭕X╳✕✘F是丵否對錯1-6])\s*[）)\]]\s*(?:第?\s*(\d+)\s*題?|\d+)[.、．:：\s]+(.*)$/i);
      const numLeadAnsQMatch = line.match(/^(?:第?\s*(\d+)\s*題?|(\d+))[.、．:：\s]+[（(\[]\s*([A-Ha-hO○⭕X╳✕✘F是丵否對錯1-6])\s*[）)\]][.、．\s]*(.*)$/i);
      const standardQMatch = line.match(/^(?:第?\s*(\d+)\s*題?|(\d+)|【\s*(\d+)\s*】|[（(]\s*(\d+)\s*[）)])[.、．:：\s]+(.*)$/i);

      if (leadAnsQMatch) {
        inIntro = false;
        const qNum = parseInt(leadAnsQMatch[2], 10);
        let ans = leadAnsQMatch[1].toUpperCase();
        if (currentSectionType === 'TF' || /^[O○⭕X╳✕✘F是丵否對錯12]$/.test(ans)) {
          ans = /^(1|O|○|⭕|T|是|對)$/i.test(ans) ? 'O' : 'X';
        }
        sectionQIndices[qNum] = outputLines.length;
        outputLines.push(`${qNum}. ${leadAnsQMatch[3].trim()}`);
        outputLines.push(`答案：${ans}`);
        extractedAnswers++;
        i++;
        continue;
      } else if (numLeadAnsQMatch) {
        inIntro = false;
        const qNum = parseInt(numLeadAnsQMatch[1] || numLeadAnsQMatch[2], 10);
        let ans = numLeadAnsQMatch[3].toUpperCase();
        if (currentSectionType === 'TF' || /^[O○⭕X╳✕✘F是丵否對錯12]$/.test(ans)) {
          ans = /^(1|O|○|⭕|T|是|對)$/i.test(ans) ? 'O' : 'X';
        }
        sectionQIndices[qNum] = outputLines.length;
        outputLines.push(`${qNum}. ${numLeadAnsQMatch[4].trim()}`);
        outputLines.push(`答案：${ans}`);
        extractedAnswers++;
        i++;
        continue;
      } else if (standardQMatch) {
        const qDigits = standardQMatch[1] || standardQMatch[2] || standardQMatch[3] || standardQMatch[4];
        const isLikelyOption = /^[（(]\s*[1-6]\s*[）)]/.test(line) && (currentSectionType === 'SINGLE' || currentSectionType === 'MULTI');
        if (!isLikelyOption) {
          inIntro = false;
          const qNum = parseInt(qDigits, 10);
          sectionQIndices[qNum] = outputLines.length;
        }
      }

      // 檢查題目結尾是否帶有答案括號: 例如 "3. SDGs 的核心精神為... (對)"
      const tailAnsMatch = line.match(/^(.*?)\s*[（(]\s*([A-Ha-hO○⭕X╳✕✘F是丵否對錯1-6])\s*[）)]\s*$/i);
      if (tailAnsMatch && !/^\s*(?:答案|解析)/.test(line)) {
        const stem = tailAnsMatch[1].trim();
        let ans = tailAnsMatch[2].toUpperCase();
        if (currentSectionType === 'TF' || /^[O○⭕X╳✕✘F是丵否對錯12]$/i.test(ans)) {
          ans = /^(1|O|○|⭕|T|是|對)$/i.test(ans) ? 'O' : 'X';
        }
        outputLines.push(stem);
        outputLines.push(`答案：${ans}`);
        extractedAnswers++;
        i++;
        continue;
      }

      // 8. 填充題格式自動對齊
      if (currentSectionType === 'FILL' || /(?:_{2,}|________+|（\s*）|\(\s*\))[（(]\s*[^()]+?\s*[）)]/.test(line)) {
        line = line.replace(/(?:_{2,}|________+|（\s*）|\(\s*\))[（(]\s*([^()]+?)\s*[）)]/g, (m, p1) => {
          convertedBlanks++;
          return `[*${p1.trim()}*]`;
        });
        if (currentSectionType === 'FILL') {
          line = line.replace(/【\s*([^【】\n]+?)\s*】/g, (m, p1) => {
            if (/是非|單選|選擇|複選|多選|填[充空]|問答|簡答|解析|說明|詳解|答案/.test(p1)) return m;
            convertedBlanks++;
            return `[*${p1.trim()}*]`;
          });
        }
      }

      // 9. 答案行標籤統一化 (Ans, Answer, Key, 【答案】, 正解：...)
      const ansKeyMatch = line.match(/^(?:【\s*(?:正確答案|答案|Ans|Answer|Key|正解|解答)\s*】|正確答案|答案|Ans|Answer|Key|正解|解答|答案是)[：:\s]*(.+)$/i);
      if (ansKeyMatch) {
        let rawAns = ansKeyMatch[1].trim();
        if (currentSectionType === 'MULTI') {
          rawAns = rawAns.replace(/[、\s]+/g, ', ').replace(/[,，]+/g, ', ');
        }
        if (/^[1-6]$/.test(rawAns) && currentSectionType !== 'TF') {
          rawAns = String.fromCharCode(64 + parseInt(rawAns, 10));
        } else if (currentSectionType === 'TF') {
          rawAns = /^(1|O|○|⭕|T|是|對)$/i.test(rawAns) ? 'O' : 'X';
        }

        const inlineExp = rawAns.match(/^(.*?)(?:[；;，,]\s*|\s+)(?:【?(?:解析|詳解|說明|解說|Rationale|Explanation)】?)[：:\s]*(.*)$/i);
        if (inlineExp) {
          outputLines.push(`答案：${inlineExp[1].trim()}`);
          if (inlineExp[2].trim()) outputLines.push(`解析：${inlineExp[2].trim()}`);
        } else {
          outputLines.push(`答案：${rawAns}`);
        }
        i++;
        continue;
      }

      // 10. 解析行標籤統一化
      const expMatch = line.match(/^(?:【\s*(?:解析|詳解|說明|解說|Rationale|Explanation)\s*】|解析|詳解|說明|解說|Rationale|Explanation)[：:\s]*(.*)$/i);
      if (expMatch) {
        outputLines.push(`解析：${expMatch[1].trim()}`);
        i++;
        continue;
      }

      // 11. 同一行多選項拆分（包含附帶來源引用與無空格黏合選項）
      // 例如: 1(A) 優先滿足... (B) ... 1(C) ... (D) ...
      // 或 (A) 15項 (B) 16項 (C) 17項 (D) 18項
      const optMatches = [];
      const optSplitPattern = /(?:(?:\s*\d+(?:,\s*\d+)*)?\s*|^)(?:[（(\[]([A-Ha-h1-6])[）)\]]|(?:^|\s+)([A-Ha-h])[.、．](?![A-Za-z])|([①②③④⑤⑥]))\s*/g;
      let om;
      while ((om = optSplitPattern.exec(line)) !== null) {
        let rawLabel = om[1] || om[2] || om[3];
        if (/^[①②③④⑤⑥]$/.test(rawLabel)) {
          rawLabel = String.fromCharCode(65 + '①②③④⑤⑥'.indexOf(rawLabel));
        } else if (/^[1-6]$/.test(rawLabel)) {
          rawLabel = String.fromCharCode(64 + parseInt(rawLabel, 10));
        } else {
          rawLabel = rawLabel.toUpperCase();
        }
        optMatches.push({ index: om.index, length: om[0].length, label: rawLabel });
      }

      if (optMatches.length >= 2) {
        splitOptions += optMatches.length;
        let prefix = line.substring(0, optMatches[0].index).trim();
        prefix = prefix.replace(/\s*\d+(?:,\s*\d+)*\s*$/, '');
        if (prefix) {
          outputLines.push(prefix);
        }

        for (let k = 0; k < optMatches.length; k++) {
          const cur = optMatches[k];
          const next = (k + 1 < optMatches.length) ? optMatches[k + 1].index : line.length;
          let optText = line.substring(cur.index + cur.length, next).trim();
          optText = optText.replace(/\s*\d+(?:,\s*\d+)*\s*$/, '');
          outputLines.push(`(${cur.label}) ${optText}`);
        }
        i++;
        continue;
      }

      // 12. 單一獨立選項正規化: 如 A. 選項 或 A、選項 或 ① 選項 或 (1) 選項
      const singleOptMatch = line.match(/^(?:[（(\[]([A-Ha-h1-6])[）)\]]|([A-Ha-h])[.、．]|([①②③④⑤⑥]))\s*(.*)$/);
      if (singleOptMatch && (currentSectionType === 'SINGLE' || currentSectionType === 'MULTI' || /^[A-Ha-h①②③④⑤⑥]/.test(line))) {
        let rawLabel = singleOptMatch[1] || singleOptMatch[2] || singleOptMatch[3];
        if (/^[①②③④⑤⑥]$/.test(rawLabel)) {
          rawLabel = String.fromCharCode(65 + '①②③④⑤⑥'.indexOf(rawLabel));
        } else if (/^[1-6]$/.test(rawLabel)) {
          rawLabel = String.fromCharCode(64 + parseInt(rawLabel, 10));
        } else {
          rawLabel = rawLabel.toUpperCase();
        }
        let optText = singleOptMatch[4].trim();
        optText = optText.replace(/\s*\d+(?:,\s*\d+)*\s*$/, '');
        outputLines.push(`(${rawLabel}) ${optText}`);
        i++;
        continue;
      }

      // 其它一般文字（題幹延續行）
      outputLines.push(line);
      i++;
    }

    const normalizedText = outputLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    const summary = `自動規格化完成：抽取 ${extractedAnswers} 題答案、拆分/規格化 ${splitOptions} 個選項、轉換 ${convertedBlanks} 個填充標記${cleanedHeaders ? '、過濾考卷標頭' : ''}。`;

    return {
      normalizedText,
      detectedCategory,
      stats: {
        extractedAnswers,
        splitOptions,
        convertedBlanks,
        cleanedHeaders,
        standardizedSections
      },
      summaryMessage: summary
    };
  }

  /**
   * 核心解析函數：將整段文字切塊並解析成題目物件陣列
   * 支援第二段式自動規格化選項 (autoNormalize = true)
   */
  function parseQuizText(rawText, defaultSectionType = null, options = { autoNormalize: true }) {
    if (!rawText || !rawText.trim()) return [];

    let textToParse = rawText;
    let normInfo = null;

    if (options && options.autoNormalize !== false) {
      normInfo = normalizeFreeformQuizText(rawText);
      textToParse = normInfo.normalizedText;
    }

    const normalized = normalizeInput(textToParse);
    const lines = normalized.split('\n');
    const questions = [];

    let currentSectionType = defaultSectionType;
    let currentCategory = (normInfo && normInfo.detectedCategory) ? normInfo.detectedCategory : '';
    let rawBlocks = [];
    let currentBlock = [];

    // 檢查某行是否為大章節標題或題型標題
    function checkHeader(line) {
      const trimmed = line.trim();

      // 檢查類別 / 章節標題: 如 "# 第一章 綠色能源" 或 "類別：資訊安全" 或 "【單元一】"
      const catMatch = trimmed.match(/^(?:#+\s*|[【\[])?(?:類別|章節|單元|章)[：:\s]+(.+?)[】\]]?$/i) ||
                       trimmed.match(/^#+\s*(第[一二三四五六七八九十0-9]+[章節單元][\s\S]*)$/i);
      if (catMatch) {
        return { type: 'CATEGORY', category: catMatch[1].trim() };
      }

      // 題型大題標題
      if (/^(#+\s*)?[一二三四五六七八九十0-9]+[、.．\s]+(是非題|判斷題|對錯題)/i.test(trimmed) ||
          /^【?(是非題|判斷題|對錯題)】?$/i.test(trimmed)) {
        return { type: 'SECTION', sectionType: QuestionType.TRUE_FALSE };
      }
      if (/^(#+\s*)?[一二三四五六七八九十0-9]+[、.．\s]+(單選題|選擇題)/i.test(trimmed) ||
          /^【?(單選題|選擇題)】?$/i.test(trimmed)) {
        return { type: 'SECTION', sectionType: QuestionType.SINGLE_CHOICE };
      }
      if (/^(#+\s*)?[一二三四五六七八九十0-9]+[、.．\s]+(複選題|多選題)/i.test(trimmed) ||
          /^【?(複選題|多選題)】?$/i.test(trimmed)) {
        return { type: 'SECTION', sectionType: QuestionType.MULTI_CHOICE };
      }
      if (/^(#+\s*)?[一二三四五六七八九十0-9]+[、.．\s]+(填充題|填空題)/i.test(trimmed) ||
          /^【?(填充題|填空題)】?$/i.test(trimmed)) {
        return { type: 'SECTION', sectionType: QuestionType.FILL_IN };
      }
      if (/^(#+\s*)?[一二三四五六七八九十0-9]+[、.．\s]+(問答題|簡答題|申論題)/i.test(trimmed) ||
          /^【?(問答題|簡答題|申論題)】?$/i.test(trimmed)) {
        return { type: 'SECTION', sectionType: QuestionType.ESSAY };
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
      if (/^\[(單選|是非|選擇|複選|多選|填充|問答|簡答)\]/i.test(trimmed)) return true;
      return false;
    }

    // 先分塊
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      const headerInfo = checkHeader(trimmed);
      if (headerInfo !== null) {
        if (currentBlock.length > 0) {
          rawBlocks.push({ sectionType: currentSectionType, category: currentCategory, lines: currentBlock });
          currentBlock = [];
        }
        if (headerInfo.type === 'CATEGORY') {
          currentCategory = headerInfo.category;
        } else if (headerInfo.type === 'SECTION') {
          currentSectionType = headerInfo.sectionType;
        }
        continue;
      }

      if (isQuestionStart(trimmed)) {
        if (currentBlock.length > 0) {
          rawBlocks.push({ sectionType: currentSectionType, category: currentCategory, lines: currentBlock });
          currentBlock = [];
        }
      }

      if (trimmed || currentBlock.length > 0) {
        currentBlock.push(line);
      }
    }

    if (currentBlock.length > 0) {
      rawBlocks.push({ sectionType: currentSectionType, category: currentCategory, lines: currentBlock });
    }

    // 逐塊解析題目
    rawBlocks.forEach((block, blockIndex) => {
      const q = parseSingleBlock(block.lines, block.sectionType, block.category, blockIndex + 1);
      if (q) {
        if (normInfo && (normInfo.stats.extractedAnswers > 0 || normInfo.stats.splitOptions > 0 || normInfo.stats.convertedBlanks > 0)) {
          q.wasAutoNormalized = true;
          q.normalizeReason = normInfo.summaryMessage;
        }
        questions.push(q);
      }
    });

    // 附加規格化元資料供介面調用
    if (normInfo) {
      questions.detectedCategory = normInfo.detectedCategory;
      questions.normalizeStats = normInfo.stats;
      questions.normalizeSummary = normInfo.summaryMessage;
    }

    return questions;
  }

  /**
   * 解析單一題目區塊
   */
  function parseSingleBlock(lines, sectionType, defaultCategory, defaultIndex) {
    if (!lines || lines.length === 0) return null;

    let questionText = '';
    let options = [];
    let answerRaw = '';
    let explanation = '';
    let category = defaultCategory || '';
    let difficulty = Difficulty.MEDIUM;
    let explicitType = sectionType;

    // 填充題特有參數
    let caseSensitive = 1; // 1: 不分大小寫, 2: 區分大小寫
    let ordered = 1;       // 1: 不考慮順序, 2: 需考慮順序

    // 題目開頭去除題號模式
    const leadNumberRegex = /^(Q\s*\d+|第\s*\d+\s*題|\d+|【\s*\d+\s*】|[（(]\s*\d+\s*[）)])[.、．:：\s]*/i;

    let state = 'QUESTION'; // 'QUESTION', 'OPTIONS', 'ANSWER', 'EXPLANATION'

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line) continue;

      // 檢查是否標註題型標籤，例如 [單選]、[是非]、[複選]、[填充]、[問答]
      const tagMatch = line.match(/^(\[(單選|選擇|是非|判斷|複選|多選|填充|填空|問答|簡答|申論)\]|【(單選|選擇|是非|判斷|複選|多選|填充|填空|問答|簡答|申論)】)\s*/i);
      if (tagMatch) {
        const tagName = tagMatch[2] || tagMatch[3];
        if (/^(單選|選擇)$/.test(tagName)) explicitType = QuestionType.SINGLE_CHOICE;
        else if (/^(是非|判斷)$/.test(tagName)) explicitType = QuestionType.TRUE_FALSE;
        else if (/^(複選|多選)$/.test(tagName)) explicitType = QuestionType.MULTI_CHOICE;
        else if (/^(填充|填空)$/.test(tagName)) explicitType = QuestionType.FILL_IN;
        else if (/^(問答|簡答|申論)$/.test(tagName)) explicitType = QuestionType.ESSAY;
        line = line.replace(tagMatch[0], '');
      }

      // 檢查行內指定類別: 如 [類別：資訊安全] 或 類別：資訊安全
      const catInlineMatch = line.match(/(?:\[|【)?(?:類別|章節|單元)[：:\s]+([^\]】\n]+)(?:\]|】)?/i);
      if (catInlineMatch) {
        category = catInlineMatch[1].trim();
        line = line.replace(catInlineMatch[0], '').trim();
        if (!line) continue;
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

        // 檢查填充題參數備註 (如: "答案: 98, 6, 19 (區分大小寫, 需考慮順序)")
        if (/區分大小寫|區分英文大小寫/i.test(remaining)) caseSensitive = 2;
        if (/需考慮順序|考慮順序/i.test(remaining)) ordered = 2;

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

    // 判斷題型 (智慧推導)
    let type = explicitType;
    if (!type) {
      // 1. 若題幹含有 [*答案*]，直接推導為填充題 (Type 4)
      if (/\[\*([^*]+)\*\]/.test(questionText)) {
        type = QuestionType.FILL_IN;
      }
      // 2. 若有多個選項
      else if (options.length >= 2) {
        // 若答案包含多個選項或標記多選，推導為複選題 (Type 3)
        if (parseMultiChoiceAnswer(answerRaw).includes(',') || /[A-T]{2,}/i.test(answerRaw)) {
          type = QuestionType.MULTI_CHOICE;
        } else {
          type = QuestionType.SINGLE_CHOICE;
        }
      }
      // 3. 若為是非題答案
      else if (parseTfAnswer(answerRaw) !== null || /^(是|否|O|X|True|False)$/i.test(answerRaw)) {
        type = QuestionType.TRUE_FALSE;
      }
      // 4. 若無選項且答案為長文字，推導為問答題 (Type 5)
      else if (answerRaw && !/^[A-Da-dO○⭕TX╳✕✘F是丵否對錯1-4]$/i.test(answerRaw) && options.length === 0) {
        type = QuestionType.ESSAY;
      }
      // 5. 預設
      else {
        type = options.length > 0 ? QuestionType.SINGLE_CHOICE : QuestionType.TRUE_FALSE;
      }
    }

    // 填充題自動修復：若為填充題但題幹沒有 [*...*]，而有下底線且答案欄有文字，自動填入空格
    if (type === QuestionType.FILL_IN && !/\[\*([^*]+)\*\]/.test(questionText)) {
      if (answerRaw && /(_{2,}|（\s*）|\(\s*\)|【\s*】)/.test(questionText)) {
        const parts = answerRaw.split(/[,，、\s]+/);
        let partIdx = 0;
        questionText = questionText.replace(/(_{2,}|（\s*）|\(\s*\)|【\s*】)/g, (match) => {
          const ans = parts[partIdx++] || '';
          return `[*${ans.trim()}*]`;
        });
      }
    }

    // 處理答案代碼與顯示
    let finalAnswer = null;
    let answerDisplay = '';

    if (type === QuestionType.TRUE_FALSE) {
      const tfCode = parseTfAnswer(answerRaw);
      if (tfCode !== null) {
        finalAnswer = tfCode;
        answerDisplay = tfCode === 1 ? '⭕ 是 (True)' : '❌ 否 (False)';
      }
    } else if (type === QuestionType.SINGLE_CHOICE) {
      const choiceIdx = parseChoiceAnswer(answerRaw);
      if (choiceIdx !== null) {
        finalAnswer = choiceIdx;
        const letter = String.fromCharCode(64 + choiceIdx);
        answerDisplay = `${letter} (選項 ${choiceIdx})`;
      }
    } else if (type === QuestionType.MULTI_CHOICE) {
      const multiCodes = parseMultiChoiceAnswer(answerRaw);
      if (multiCodes) {
        finalAnswer = multiCodes;
        const letters = multiCodes.split(',').map(n => String.fromCharCode(64 + parseInt(n, 10))).join(', ');
        answerDisplay = `${letters} (${multiCodes})`;
      }
    } else if (type === QuestionType.FILL_IN) {
      // 填充題答案在 CSV 中留空，在 UI 顯示內嵌的所有答案
      finalAnswer = '';
      const blanks = [];
      const blankRegex = /\[\*([^*]+)\*\]/g;
      let bm;
      while ((bm = blankRegex.exec(questionText)) !== null) {
        blanks.push(bm[1].trim());
      }
      answerDisplay = blanks.length > 0 ? blanks.join(' / ') : '（未標註空格）';
    } else if (type === QuestionType.ESSAY) {
      finalAnswer = answerRaw || '';
      answerDisplay = answerRaw ? (answerRaw.length > 30 ? answerRaw.substring(0, 30) + '...' : answerRaw) : '（無參考答案）';
    }

    // 整理選項文字陣列
    const finalOptions = options.map(o => o.text);

    return {
      id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      index: defaultIndex,
      type: type,
      category: category,
      stem: questionText,
      options: finalOptions,
      answer: finalAnswer,
      answerDisplay: answerDisplay,
      explanation: explanation,
      difficulty: difficulty,
      // 填充題專屬
      caseSensitive: caseSensitive,
      ordered: ordered
    };
  }

  /**
   * 嚴格防呆檢核引擎 (Strict Validation Engine)
   */
  function validateQuestions(questions) {
    const issues = [];
    if (!Array.isArray(questions) || questions.length === 0) {
      return {
        isValid: false,
        totalQuestions: 0,
        invalidCount: 0,
        issues: [{ index: 0, type: 'EMPTY_LIST', message: '目前沒有任何可匯出的題目，請先貼上題目並點擊解析。' }]
      };
    }

    questions.forEach((q, idx) => {
      const qIndex = q.index || (idx + 1);

      // 1. 檢核題幹是否為空
      if (!q.stem || !q.stem.trim()) {
        issues.push({
          index: qIndex,
          id: q.id,
          field: 'stem',
          severity: 'error',
          message: `第 ${qIndex} 題：題幹文字為空，無法匯入系統。`
        });
      }

      // 2. 是非題檢核 (Type 1)
      if (q.type === QuestionType.TRUE_FALSE) {
        if (q.answer !== 1 && q.answer !== 2) {
          issues.push({
            index: qIndex,
            id: q.id,
            field: 'answer',
            severity: 'error',
            message: `第 ${qIndex} 題（是非題）：未設定正確答案（必須為「⭕ 是」或「❌ 否」）。`
          });
        }
      }

      // 3. 單選題檢核 (Type 2)
      if (q.type === QuestionType.SINGLE_CHOICE) {
        if (!Array.isArray(q.options) || q.options.length < 2) {
          issues.push({
            index: qIndex,
            id: q.id,
            field: 'options',
            severity: 'error',
            message: `第 ${qIndex} 題（單選題）：選項數量不足（目前僅有 ${q.options ? q.options.length : 0} 個，至少需要 2 個選項）。`
          });
        }

        if (q.answer === null || q.answer === undefined || q.answer === '') {
          issues.push({
            index: qIndex,
            id: q.id,
            field: 'answer',
            severity: 'error',
            message: `第 ${qIndex} 題（單選題）：未設定正確答案，請點擊選項圓鈕指定答案。`
          });
        } else {
          const ansNum = parseInt(q.answer, 10);
          const optCount = q.options ? q.options.length : 0;
          if (isNaN(ansNum) || ansNum < 1 || ansNum > optCount) {
            const letter = String.fromCharCode(64 + ansNum);
            issues.push({
              index: qIndex,
              id: q.id,
              field: 'answer',
              severity: 'error',
              message: `第 ${qIndex} 題（單選題）：答案代碼「${letter || ansNum}」超出目前選項數量（僅有 ${optCount} 個選項）。`
            });
          }
        }
      }

      // 4. 複選題檢核 (Type 3)
      if (q.type === QuestionType.MULTI_CHOICE) {
        if (!Array.isArray(q.options) || q.options.length < 2) {
          issues.push({
            index: qIndex,
            id: q.id,
            field: 'options',
            severity: 'error',
            message: `第 ${qIndex} 題（複選題）：選項數量不足（至少需要 2 個選項）。`
          });
        }
        if (!q.answer || typeof q.answer !== 'string' || !q.answer.trim()) {
          issues.push({
            index: qIndex,
            id: q.id,
            field: 'answer',
            severity: 'error',
            message: `第 ${qIndex} 題（複選題）：未設定正確答案，請勾選正確選項。`
          });
        } else {
          const selected = q.answer.split(',').map(n => parseInt(n.trim(), 10));
          const optCount = q.options ? q.options.length : 0;
          const outOfBounds = selected.filter(n => isNaN(n) || n < 1 || n > optCount);
          if (outOfBounds.length > 0) {
            issues.push({
              index: qIndex,
              id: q.id,
              field: 'answer',
              severity: 'error',
              message: `第 ${qIndex} 題（複選題）：部分答案超出選項數量範圍。`
            });
          }
        }
      }

      // 5. 填充題檢核 (Type 4)
      if (q.type === QuestionType.FILL_IN) {
        const hasBlank = /\[\*([^*]+)\*\]/.test(q.stem || '');
        if (!hasBlank) {
          issues.push({
            index: qIndex,
            id: q.id,
            field: 'stem',
            severity: 'error',
            message: `第 ${qIndex} 題（填充題）：題幹內必須包含至少一個 [*空格答案*] 標記，例如「地球約有[*70%*]為海洋」。`
          });
        }
      }

      // 6. 問答題檢核 (Type 5)
      if (q.type === QuestionType.ESSAY) {
        if (!q.answer || !String(q.answer).trim()) {
          issues.push({
            index: qIndex,
            id: q.id,
            field: 'answer',
            severity: 'warning',
            message: `第 ${qIndex} 題（問答題）：尚未填寫參考答案（建議補充便於評分）。`
          });
        }
      }
    });

    const errorCount = issues.filter(i => i.severity === 'error').length;
    return {
      isValid: errorCount === 0,
      totalQuestions: questions.length,
      errorCount: errorCount,
      warningCount: issues.filter(i => i.severity === 'warning').length,
      issues: issues
    };
  }

  // 導出模組
  global.QuizParser = {
    QuestionType,
    Difficulty,
    normalizeInput,
    normalizeFreeformQuizText,
    parseTfAnswer,
    parseChoiceAnswer,
    parseMultiChoiceAnswer,
    parseDifficulty,
    parseQuizText,
    validateQuestions
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.QuizParser;
  }

})(typeof window !== 'undefined' ? window : globalThis);
