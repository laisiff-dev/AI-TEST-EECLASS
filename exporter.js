/**
 * ee-Class 題目匯出器 (ee-Class Quiz Exporter)
 * 支援:
 * 1. ee-class 專用 CSV (UTF-8 BOM, Tab 分隔, Version 4 範本相容)
 * 2. GIFT 格式 (.gift / .txt)，Moodle / ee-Class 均支援
 * 3. JSON 格式 (題庫備份與還原)
 */

(function (global) {
  'use strict';

  // ee-Class 標準欄位名稱 (Row 2 Header)
  const EECLASS_HEADERS = [
    '題組',
    '類別 \n(格式相容欄位，匯入線上測驗時不支援)',
    '題型: \n(1)是非\n(2)單選  \n(3)複選  \n(4)填充 \n(5)問答\n(6)說明\n(7)題組',
    '題目',
    '答案\n若為是非題: \n(1)答案為是\n(2)答案為否',
    '解說\n(說明沒有解說)',
    '難易度:\n(1)容易\n(2)適中\n(3)困難',
    '選項1\n若為填充題: \n(1)不區分英文大小寫\n(2)區分英文大小寫',
    '選項2 \n若為填充題: \n(1)不需考慮順序\n(2)需考慮順序 ',
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
   * 產出 ee-class 官方標準 CSV (Version 4 規範, 27 欄逗號分隔, UTF-8 with BOM)
   * questions: 題目物件陣列
   */
  function generateEeclassCsv(questions) {
    const rows = [];

    // 第一行: version: 4 加 26 個空逗號 (共 27 欄)
    // 官方標準: version: 4,,,,,,,,,,,,,,,,,,,,,,,,,,
    const row1 = ['version: 4'].concat(new Array(26).fill(''));
    rows.push(row1.map(escapeCsvField).join(','));

    // 第二行: 27 個欄位說明標題 (逗號分隔)
    rows.push(EECLASS_HEADERS.map(escapeCsvField).join(','));

    // 第三行開始: 題目資料 (嚴格確保每行恰好 27 欄，以逗號分隔)
    questions.forEach((q, idx) => {
      const row = new Array(27).fill('');

      // Col 0: 題組
      row[0] = '';
      // Col 1: 類別 (格式相容欄位，線上測驗留空)
      row[1] = '';
      // Col 2: 題型 (1: 是非, 2: 單選)
      row[2] = q.type ? String(q.type) : '2';
      // Col 3: 題目
      row[3] = q.stem || '';
      // Col 4: 答案 (是非題: 1為是, 2為否; 單選題: 1~20 對應選項)
      row[4] = q.answer !== null && q.answer !== undefined ? String(q.answer) : '';
      // Col 5: 解說
      row[5] = q.explanation || '';
      // Col 6: 難易度 (1:容易, 2:適中, 3:困難)
      row[6] = q.difficulty ? String(q.difficulty) : '2';

      // 選項欄位 Col 7 .. 26 (選項1 ~ 選項20，共 20 欄)
      if (q.type === 2 && Array.isArray(q.options)) {
        // 單選題
        for (let i = 0; i < 20; i++) {
          if (i < q.options.length) {
            row[7 + i] = q.options[i] || '';
          } else {
            row[7 + i] = '';
          }
        }
      } else {
        // 是非題所有選項留空 (20 個空欄位)
        for (let i = 0; i < 20; i++) {
          row[7 + i] = '';
        }
      }

      rows.push(row.map(escapeCsvField).join(','));
    });

    // 換行符號使用標準 Windows CRLF (\r\n)
    const content = rows.join('\r\n') + '\r\n';
    // 加上 UTF-8 BOM (\uFEFF) 確保 Excel 與 ee-Class 正確辨識為 UTF-8 編碼
    return '\uFEFF' + content;
  }

  /**
   * 產出 GIFT 格式
   * 適合在 ee-class 選擇 GIFT 格式匯入
   */
  function generateGift(questions) {
    let output = '// GIFT Format exported for ee-class\n\n';

    questions.forEach((q, idx) => {
      const title = `::Q${idx + 1}::`;
      const cleanStem = (q.stem || '').replace(/[{}=~#]/g, '\\$&');
      const cleanExp = (q.explanation || '').replace(/[{}=~#]/g, '\\$&');
      const feedback = cleanExp ? `#${cleanExp}` : '';

      if (q.type === 1) {
        // 是非題: {T#feedback} 或 {F#feedback}
        const isTrue = q.answer === 1;
        const tfChar = isTrue ? 'TRUE' : 'FALSE';
        output += `${title} ${cleanStem} {${tfChar}${feedback}}\n\n`;
      } else {
        // 單選題
        output += `${title} ${cleanStem} {\n`;
        const ansIndex = parseInt(q.answer, 10); // 1-based index (1=A, 2=B...)

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
      }
    });

    return output;
  }

  /**
   * 產出 JSON 格式
   */
  function generateJson(questions) {
    return JSON.stringify({
      version: 'ee-class-converter-v1',
      exportedAt: new Date().toISOString(),
      count: questions.length,
      questions: questions
    }, null, 2);
  }

  /**
   * 觸發瀏覽器下載檔案
   */
  function triggerDownload(content, filename, mimeType = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], { type: mimeType });
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

  // 導出模組
  global.QuizExporter = {
    generateEeclassCsv,
    generateGift,
    generateJson,
    triggerDownload
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.QuizExporter;
  }

})(typeof window !== 'undefined' ? window : globalThis);
