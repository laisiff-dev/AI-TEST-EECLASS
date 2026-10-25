# ee-Class 智慧題庫與考題轉換系統 (AI & Docx Quiz Converter Pro 2026)

專為大學與技職院校教師設計的 **AI 題庫與考題檔案轉化系統**。整合 [Tools_QB](https://github.com/RelerChenTajen/Tools_QB) 專業題庫轉換架構，把「老師手上的考題檔（Word .docx / Markdown .md / 純文字 .txt）」或 AI（ChatGPT、Claude、Gemini、DeepSeek）生成的題目，快速、精準轉化為 **ee-Class / TronClass** 測驗平台支援的 **官方 27 欄 CSV (Version 4 規範)** 與 **GIFT** 匯入格式，並支援 **UTF-8 with BOM** 與 **Big5 (CP950) 副本**雙編碼輸出！

---

## 🌟 核心功能特色 (Tools_QB 增強放大版)

```
   📄 考題檔                 🤖 瀏覽器 / AI / CLI             📊 題庫匯入檔
  Word / PDF / md   ──▶     智慧解析與視覺化編輯     ──▶   1. ee-Class CSV (UTF-8 BOM)
                                                           2. Big5 副本 CSV (CP950)
                                                           3. Moodle/ee-Class GIFT
```

1. **📁 支援 Word (.docx) 考題檔直接拖曳抽取**：
   - 老師手中的段考、期中考、模擬考 Word 檔不用手動一題題複製貼上！
   - 瀏覽器端與 Python 端均內建純文字 XML 段落抽取引擎，直接把 `.docx`、`.md`、`.txt` 拖入網頁即可秒速抽取題幹與選項！
2. **🎯 5 大完整題型全面支援 (Full 5 Question Types)**：
   - **題型 1 是非題 (True/False)**：答案代碼 `1`=是、`2`=否。
   - **題型 2 單選題 (Single Choice)**：支援 2~20 個選項 (A..T)，答案填寫選項序號 `1~20`。
   - **題型 3 複選題 (Multiple Choice)**：支援多選項勾選，答案自動以逗號連接 `"1,2,4"`（或 `A, C, D`）。
   - **題型 4 填充題 (Fill-in-the-blank)**：題幹內嵌 `[*答案*]`（單題可多格），答案欄官方規定留空，第 8 欄支援大小寫比對（`1`=不分大小寫、`2`=區分大小寫），第 9 欄支援順序比對（`1`=不考慮順序、`2`=需考慮順序）。
   - **題型 5 問答題 / 簡答題 (Essay)**：題幹完整呈現，答案欄直接填入參考答案與評分重點。
3. **🏷️ 題庫「類別 (Category)」全域與單題管理**：
   - 嚴格對應 ee-Class CSV 第 2 欄「類別」。
   - 可一鍵設定「全域類別 / 所屬章節」（如：`單元一：環境微生物學基礎`），亦可在題目預覽卡片中個別修改每題章節。
4. **📑 雙編碼雙輸出 (Dual Encoding Output)**：
   - 📥 **ee-Class 官方標準 CSV (UTF-8 with BOM)**：嚴格符合 Version 4 規格（首行 `version: 4,,,,,,,,,,,,,,,,,,,,,,,,,,`，標準 27 欄逗號分隔），解決新版測驗平台與 Excel 中文亂碼。
   - 📑 **Big5 副本 CSV (CP950 編碼)**：專為僅支援 Big5 的舊型校務測驗系統設計，自動執行數學與符號等義修復（`≥`&rarr;`≧`、`≤`&rarr;`≦`、`・`&rarr;`‧`），消除亂碼。
   - 🎁 **Moodle / ee-Class GIFT 格式**：標準測驗交換格式，跳脫特殊符號，支援 5 大題型上傳。
5. **🛡️ 嚴格檢核防呆與阻擋機制 (Strict Validation & Blocking Engine)**：
   - 匯出前全方位自動檢核：題幹是否空白、是否缺少答案、單選/複選選項是否少於 2 個、答案是否超出選項字母、填充題是否包含 `[*...*]` 標記。
   - 若有瑕疵即時彈出診斷清單並阻擋匯出，確保所匯出之檔案在 ee-Class 100% 成功匯入，零瑕疵保證！
6. **🤖 遵循 Agent Skills 開放標準 (`skill/exam-to-qb/`)**：
   - 本專案內附相容 Agent Skills 開放標準之技能套件，可直接掛載於 **Claude Code** (`~/.claude/skills/`)、**OpenAI Codex** (`~/.agents/skills/`) 與 **Gemini CLI / Antigravity**。

---

## 🌐 線上免安裝版 (GitHub Pages)

即開即用，任何裝置、手機或電腦無需安裝任何環境：
👉 **[https://laisiff-dev.github.io/AI-TEST-EECLASS/](https://laisiff-dev.github.io/AI-TEST-EECLASS/)**

---

## 🖥️ 快速使用指南

### 方式一：使用現代化 Web 介面 (最推薦)

1. 開啟 [GitHub Pages 線上版](https://laisiff-dev.github.io/AI-TEST-EECLASS/) 或本地開啟 [index.html](file:///f:/%E6%96%87%E4%BA%AE/ANTIGRAVITY/homework%E2%80%94%EF%BD%89%EF%BD%8D%EF%BD%90%EF%BD%8F%EF%BD%92%EF%BD%94/index.html)。
2. **操作步驟**：
   - **步驟 1**：將老師的考題 Word 檔 (`.docx`) 拖入拖曳區，或貼上 AI 生成的題目文字。
   - **步驟 2**：輸入「全域題庫類別」（選填），點擊「🚀 立即智慧解析並預覽」。
   - **步驟 3**：在「2. 題目預覽與編輯」中校對 5 大題型（是非按鈕切換、單選單選鈕、複選勾選框、填充空格標籤、問答參考答案）。
   - **步驟 4**：點擊右上角按鈕匯出：
     - **「📥 匯出 ee-class CSV」**（UTF-8 with BOM 官方標準）
     - **「📑 匯出 Big5 副本」**（舊系統專用）
     - **「🎁 匯出 GIFT 格式」**

---

### 方式二：使用 Python 命令列工具 (CLI 批次轉檔)

支援直接傳入 `.docx` 檔案或純文字檔：

```bash
# 1. 直接轉換 Word 考題檔，填入類別並同時產生 Big5 副本
python convert_ai_to_eeclass.py exam.docx -o exam.csv --category "環境微生物學" --big5

# 2. 轉換純文字題庫檔
python convert_ai_to_eeclass.py sample_ai_questions.txt -o my_quiz.csv --big5

# 3. 轉為 GIFT 測驗格式
python convert_ai_to_eeclass.py sample_ai_questions.txt --format gift -o my_quiz.gift
```

---

## 📊 ee-Class 官方 27 欄位速查表

| 欄號 | 欄位名稱 | 填寫規範與 5 大題型對應 |
| :---: | :--- | :--- |
| **Col 1** | 題組 | 留空（題庫不支援題組） |
| **Col 2** | 類別 | 可選；填寫所屬章節或主題（如：`第一章 綠色能源`） |
| **Col 3** | 題型 | `1`=是非、`2`=單選、`3`=複選、`4`=填充、`5`=問答 |
| **Col 4** | 題目 | 題幹；**填充題**需將答案內嵌為 `[*答案*]` |
| **Col 5** | 答案 | 是非: `1`=是/`2`=否；單選: 選項序號；複選: 逗號相連 `"1,2,4"`；填充: **留空**；問答: 參考答案 |
| **Col 6** | 解說 | 題目詳解說明 |
| **Col 7** | 難易度 | `1`=容易、`2`=適中、`3`=困難 |
| **Col 8** | 選項 1 | 選擇題: 選項 A 文字；**填充題**: `1`=不分大小寫 / `2`=區分大小寫 |
| **Col 9** | 選項 2 | 選擇題: 選項 B 文字；**填充題**: `1`=不考慮順序 / `2`=需考慮順序 |
| **Col 10~27**| 選項 3~20 | 選擇題其餘選項文字；其餘題型留空 |

---

## 📁 檔案結構說明

| 檔案/資料夾 | 說明 |
| :--- | :--- |
| [index.html](file:///f:/%E6%96%87%E4%BA%AE/ANTIGRAVITY/homework—ｉｍｐｏｒｔ/index.html) | 主應用程式網頁介面 (HTML5) |
| [style.css](file:///f:/%E6%96%87%E4%BA%AE/ANTIGRAVITY/homework—ｉｍｐｏｒｔ/style.css) | 玻璃擬態科技風現代 CSS 樣式庫 |
| [parser.js](file:///f:/%E6%96%87%E4%BA%AE/ANTIGRAVITY/homework—ｉｍｐｏｒｔ/parser.js) | 5 大題型與類別智慧解析核心引擎 |
| [exporter.js](file:///f:/%E6%96%87%E4%BA%AE/ANTIGRAVITY/homework—ｉｍｐｏｒｔ/exporter.js) | ee-Class 27 欄 CSV (UTF-8 / Big5) 與 GIFT 匯出引擎 |
| [big5-encoder.js](file:///f:/%E6%96%87%E4%BA%AE/ANTIGRAVITY/homework—ｉｍｐｏｒｔ/big5-encoder.js) | 瀏覽器端 Big5 / CP950 二進位轉碼器 (含符號等義修復) |
| [jszip.min.js](file:///f:/%E6%96%87%E4%BA%AE/ANTIGRAVITY/homework—ｉｍｐｏｒｔ/jszip.min.js) | 瀏覽器端 Word (.docx) 離線解壓與文字抽取套件 |
| [app.js](file:///f:/%E6%96%87%E4%BA%AE/ANTIGRAVITY/homework—ｉｍｐｏｒｔ/app.js) | 前端控制器、檔案拖曳處理、5題型編輯互動與防呆驗證 |
| [convert_ai_to_eeclass.py](file:///f:/%E6%96%87%E4%BA%AE/ANTIGRAVITY/homework—ｉｍｐｏｒｔ/convert_ai_to_eeclass.py) | Python 命令列獨立轉檔工具 (支援 .docx、類別與 Big5) |
| [skill/exam-to-qb/](file:///f:/%E6%96%87%E4%BA%AE/ANTIGRAVITY/homework—ｉｍｐｏｒｔ/skill/exam-to-qb/) | Agent Skills 開放標準技能套件 (Claude / Codex / Gemini CLI) |
| [sample_ai_questions.txt](file:///f:/%E6%96%87%E4%BA%AE/ANTIGRAVITY/homework—ｉｍｐｏｒｔ/sample_ai_questions.txt) | 5 大題型綜合測試範例題庫 |
