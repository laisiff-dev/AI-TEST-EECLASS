/**
 * ee-Class 題目匯出器 (ee-Class Quiz Exporter) - Pro 2026
 * 整合 Tools_QB 規範，全面支援 5 大完整題型與雙編碼架構：
 * 1. ee-Class 官方標準 CSV (Version 4 規範, 27 欄逗號分隔, UTF-8 with BOM)
 * 2. Big5 副本 CSV (CP950 編碼, 自動符號等義修復, 給舊題庫系統)
 * 3. GIFT 格式 (.gift / .txt)，Moodle / ee-Class 均支援 5 大題型
 * 4. JSON 題庫結構備份與還原
 */

(function (global) {
  'use strict';

  // ee-Class 標準欄位名稱 (Row 2 Header - 27 欄)
  const EECLASS_HEADERS = [
    '題組 (格式相容欄位，題庫不支援)',
    '類別 (匯入線上測驗時不支援)',
    '題型: \n(1)是非\n(2)單選  \n(3)複選  \n(4)填充 \n(5)問答',
    '題目',
    '答案\n若為是非題: \n(1)答案為是\n(2)答案為否',
    '解說\n(說明沒有解說)',
    '難易度:\n(1)容易\n(2)適中\n(3)困難',
    '選項1\n若為填充題: \n(1)不分英文大小寫\n(2)區分英文大小寫',
    '選項2 \n若為填充題: \n(1)不考慮順序\n(2)需考慮順序 ',
    '選項3 ',
    '選項4',
    '選項5',
    '選項6',
    '選項7',
    '選項8',
    '選項9',
    '選項10',
    '選項11',
    '選項12',
    '選項13',
    '選項14',
    '選項15',
    '選項16',
    '選項17',
    '選項18',
    '選項19',
    '選項20'
  ];

  /**
   * RFC 4180 標準 CSV 欄位跳脫處理
   * 若含逗號 ,、分號 ;、換行 \r\n 或雙引號 "，則以雙引號外包，內部雙引號以 "" 跳脫
   */
  function escapeCsvField(val) {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (/[,;\r\n"]/.test(str)) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  /**
   * 產出 ee-Class 官方標準 CSV 字串 (Version 4 規範, 27 欄逗號分隔)
   * @param {Array} questions 題目物件陣列
   * @param {string} globalCategory 全域題庫類別（若每題未設定則套用此類別）
   * @param {Object} options { withBom: true/false }
   */
  function generateEeclassCsv(questions, globalCategory = '', options = { withBom: true }) {
    const rows = [];

    // 第一行: version: 4 加 26 個空逗號 (共 27 欄)
    // 官方規格: version: 4,,,,,,,,,,,,,,,,,,,,,,,,,,
    const row1 = ['version: 4'].concat(new Array(26).fill(''));
    rows.push(row1.map(escapeCsvField).join(','));

    // 第二行: 27 個欄位說明標題 (逗號分隔)
    rows.push(EECLASS_HEADERS.map(escapeCsvField).join(','));

    // 第三行開始: 題目資料 (嚴格確保每行恰好 27 欄，以逗號分隔)
    questions.forEach((q) => {
      const row = new Array(27).fill('');

      // Col 0 (欄1): 題組 (題庫不支援，留空)
      row[0] = '';

      // Col 1 (欄2): 類別 (每題個別類別優先，次為全域類別)
      row[1] = q.category || globalCategory || '';

      // Col 2 (欄3): 題型代碼 (1: 是非, 2: 單選, 3: 複選, 4: 填充, 5: 問答)
      const qType = q.type ? parseInt(q.type, 10) : 2;
      row[2] = String(qType);

      // Col 3 (欄4): 題目題幹
      // 填充題必須包含 [*答案*]
      row[3] = q.stem || '';

      // Col 4 (欄5): 答案
      if (qType === 1) {
        // 是非題: 1 代表是, 2 代表否
        row[4] = q.answer !== null && q.answer !== undefined ? String(q.answer) : '';
      } else if (qType === 2) {
        // 單選題: 1~20 對應選項代碼
        row[4] = q.answer !== null && q.answer !== undefined ? String(q.answer) : '';
      } else if (qType === 3) {
        // 複選題: 逗號相連數字字串，如 "1,2,4" (CSV 跳脫器會自動包裹雙引號)
        row[4] = q.answer ? String(q.answer).trim() : '';
      } else if (qType === 4) {
        // 填充題: 官方規格此欄「留空」（答案已內嵌於題幹 [*...*] 中）
        row[4] = '';
      } else if (qType === 5) {
        // 問答題: 參考答案
        row[4] = q.answer || '';
      }

      // Col 5 (欄6): 解說 / 詳解
      row[5] = q.explanation || '';

      // Col 6 (欄7): 難易度 (1:容易, 2:適中, 3:困難)
      row[6] = q.difficulty ? String(q.difficulty) : '2';

      // 選項欄位 Col 7 .. 26 (選項1 ~ 選項20，共 20 欄)
      if (qType === 2 || qType === 3) {
        // 單選題與複選題: 填入各選項文字 (A~T)
        const opts = Array.isArray(q.options) ? q.options : [];
        for (let i = 0; i < 20; i++) {
          row[7 + i] = i < opts.length ? (opts[i] || '') : '';
        }
      } else if (qType === 4) {
        // 填充題:
        // 選項1 (Col 7): 1=不分英文大小寫, 2=區分英文大小寫 (預設 1)
        row[7] = q.caseSensitive ? String(q.caseSensitive) : '1';
        // 選項2 (Col 8): 1=不考慮順序, 2=需考慮順序 (預設 1)
        row[8] = q.ordered ? String(q.ordered) : '1';
        // 選項3~20 留空
        for (let i = 2; i < 20; i++) {
          row[7 + i] = '';
        }
      } else {
        // 是非題與問答題: 所有 20 個選項欄位皆留空
        for (let i = 0; i < 20; i++) {
          row[7 + i] = '';
        }
      }

      rows.push(row.map(escapeCsvField).join(','));
    });

    // 換行符號使用標準 Windows CRLF (\r\n)
    const content = rows.join('\r\n') + '\r\n';

    // 根據 options 決定是否加 UTF-8 BOM (\uFEFF)
    return (options && options.withBom) ? ('\uFEFF' + content) : content;
  }

  /**
   * 產出 GIFT 測驗格式
   * 完整相容 5 大題型：是非、單選、複選（權重比率）、填充、問答
   */
  function generateGift(questions, globalCategory = '') {
    let output = '// GIFT Format exported for ee-class / Moodle\n';
    if (globalCategory) {
      output += `$CATEGORY: ${globalCategory}\n\n`;
    } else {
      output += '\n';
    }

    questions.forEach((q, idx) => {
      const qNum = idx + 1;
      const title = `::Q${qNum}::`;
      const cleanStem = (q.stem || '').replace(/[{}=~#]/g, '\\$&');
      const cleanExp = (q.explanation || '').replace(/[{}=~#]/g, '\\$&');
      const feedback = cleanExp ? `#${cleanExp}` : '';

      if (q.type === 1) {
        // 1. 是非題: {T#feedback} 或 {F#feedback}
        const isTrue = q.answer === 1;
        const tfChar = isTrue ? 'TRUE' : 'FALSE';
        output += `${title} ${cleanStem} {${tfChar}${feedback}}\n\n`;
      } else if (q.type === 2) {
        // 2. 單選題: { =正確 ~錯誤 }
        output += `${title} ${cleanStem} {\n`;
        const ansIndex = parseInt(q.answer, 10);
        if (Array.isArray(q.options) && q.options.length > 0) {
          q.options.forEach((optText, optIdx) => {
            const isCorrect = (optIdx + 1) === ansIndex;
            const prefix = isCorrect ? '=' : '~';
            const cleanOpt = (optText || '').replace(/[{}=~#]/g, '\\$&');
            const itemFeedback = isCorrect ? feedback : '';
            output += `    ${prefix}${cleanOpt}${itemFeedback}\n`;
          });
        }
        output += `}\n\n`;
      } else if (q.type === 3) {
        // 3. 複選題: 依正解數量分配百分比 (如 2 正解 -> ~%50%..., 負分項 -> ~%-50%...)
        output += `${title} ${cleanStem} {\n`;
        const correctIndices = String(q.answer || '')
          .split(',')
          .map(n => parseInt(n.trim(), 10))
          .filter(n => !isNaN(n));
        const totalCorrect = correctIndices.length;
        const correctWeight = totalCorrect > 0 ? (100 / totalCorrect).toFixed(2) : '50.00';
        const wrongCount = (q.options ? q.options.length : 0) - totalCorrect;
        const wrongWeight = wrongCount > 0 ? (-100 / wrongCount).toFixed(2) : '-50.00';

        if (Array.isArray(q.options)) {
          q.options.forEach((optText, optIdx) => {
            const isCorrect = correctIndices.includes(optIdx + 1);
            const weight = isCorrect ? `%${correctWeight}%` : `%${wrongWeight}%`;
            const cleanOpt = (optText || '').replace(/[{}=~#]/g, '\\$&');
            const itemFeedback = isCorrect ? feedback : '';
            output += `    ~${weight}${cleanOpt}${itemFeedback}\n`;
          });
        }
        output += `}\n\n`;
      } else if (q.type === 4) {
        // 4. 填充題: 題幹中把 [*答案*] 轉化為 {=答案}
        let giftStem = cleanStem.replace(/\[\*([^*]+)\*\]/g, (match, p1) => {
          const cleanAns = p1.trim().replace(/[{}=~#]/g, '\\$&');
          return `{=${cleanAns}${feedback}}`;
        });
        output += `${title} ${giftStem}\n\n`;
      } else if (q.type === 5) {
        // 5. 問答題 / 申論題: GIFT 格式中空白大括號 {} 代表問答題
        output += `${title} ${cleanStem} {${feedback}}\n\n`;
      }
    });

    return output;
  }

  /**
   * 產出 JSON 格式
   */
  function generateJson(questions, globalCategory = '') {
    return JSON.stringify({
      version: 'ee-class-converter-pro-v2',
      category: globalCategory || '',
      exportedAt: new Date().toISOString(),
      count: questions.length,
      questions: questions
    }, null, 2);
  }

  /**
   * 觸發瀏覽器下載純文字或 Blob 檔案
   */
  function triggerDownload(content, filename, mimeType = 'text/plain;charset=utf-8') {
    let blob;
    if (content instanceof Blob) {
      blob = content;
    } else if (content instanceof Uint8Array) {
      blob = new Blob([content], { type: mimeType });
    } else {
      blob = new Blob([content], { type: mimeType });
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  }

  /**
   * 匯出 Big5 副本 CSV (CP950 編碼)
   * 調用 Big5Encoder 進行字元等義替換與二進位轉碼
   */
  async function exportBig5Csv(questions, globalCategory = '', filename = 'eeclass_exam_big5.csv') {
    // 取得不帶 BOM 的 CSV 純文字
    const csvText = generateEeclassCsv(questions, globalCategory, { withBom: false });
    if (typeof global.Big5Encoder !== 'undefined' && typeof global.Big5Encoder.encode === 'function') {
      const big5Bytes = await global.Big5Encoder.encode(csvText);
      triggerDownload(big5Bytes, filename, 'text/csv;charset=big5');
    } else {
      // 降級保護
      triggerDownload(csvText, filename, 'text/csv;charset=big5');
    }
  }

  // 導出模組
  global.QuizExporter = {
    generateEeclassCsv,
    generateGift,
    generateJson,
    triggerDownload,
    exportBig5Csv
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.QuizExporter;
  }

})(typeof window !== 'undefined' ? window : globalThis);
