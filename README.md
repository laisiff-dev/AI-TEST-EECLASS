# ee-Class 智慧題目轉換系統 (AI Quiz Converter)

專為大學與技職院校教師設計的 **AI 題庫轉化系統**。能夠將 ChatGPT、Claude、Gemini、DeepSeek 等 AI 生成的「選擇題」與「是非題」，快速且精準地轉化為 **ee-Class / TronClass** 測驗平台支援的 **CSV (Version 4 規範)** 與 **GIFT** 匯入格式。

---

## 🌟 核心功能特色

1. **零安裝、開箱即用**：
   - 直接以瀏覽器開啟 [index.html](file:///f:/%E6%96%87%E4%BA%AE/ANTIGRAVITY/homework%E2%80%94%EF%BD%89%EF%BD%8D%EF%BD%90%EF%BD%92%EF%BD%94/index.html) 即可使用現代化圖形介面，或啟動本機伺服器使用。
2. **多格式智慧辨識 (Smart AI Parser)**：
   - 自動辨識大題標題（如：`一、單選題`、`二、是非題`）。
   - 自動解析選項 `(A)~(D)`、`A.`、`A、` 或單行多選項模式。
   - 自動解析是非題答案：`O/X`、`是/否`、`對/錯`、`True/False`。
   - 自動萃取題目難易度（容易/適中/困難）與題目解析/詳解。
   - 全形半形、繁簡中文與 Markdown 粗體星號自動過濾處理。
3. **🛡️ 嚴格檢核防呆與阻擋機制 (Strict Validation & Blocking Engine)**：
   - 依據 ee-Class 官方 Version 4 規格進行全方位檢核。
   - 當發現題目**缺少答案**、**單選題選項少於 2 個**、**答案超出選項字母**或**題幹空白**時，自動彈出診斷清單並**嚴格阻擋匯出**，防止匯入後系統出錯或學生計分爭議，確保 100% 零瑕疵匯入。
4. **📖 匯入格式規範手冊與常見錯誤對照**：
   - 內建專屬手冊頁籤，詳細規範單選題/是非題標準語法、必要欄位與支援代碼。
   - 提供「✅ 正確格式範本」vs「❌ 常見 3 大格式錯誤與修復建議」對照表，並支援一鍵複製範本。
5. **視覺化題目編輯與校對 (Visual Editor)**：
   - 卡片式預覽每一道題目，可直接修改題幹、選項、答案與解析。
   - 單選題點擊單選圓鈕即可快速切換正確答案。
   - 是非題提供大型 `[ ⭕ 是 ]` 與 `[ ❌ 否 ]` 狀態按鈕，一鍵即時切換。
   - 支援題目向上/向下排序、複製題目、刪除題目與即時驗證警告（防缺答案）。
6. **雙格式完美支援**：
   - 📥 **ee-Class CSV 格式**：依據 ee-Class Version 4 官方標準規範產生，採用 **UTF-8 with BOM** 編碼與標準逗號（Comma, `,`）分隔，欄位正確包裹雙引號，嚴格符合 27 欄位標準結構，徹底解決測驗平台匯入與 Excel 亂碼問題。
   - 🎁 **Moodle / ee-Class GIFT 格式**：相容標準測驗格式，跳脫特殊符號，直接以 GIFT 格式上傳。
7. **🌐 GitHub Pages 線上免安裝版**：
   - 線上即用網址：[https://laisiff-dev.github.io/AI-TEST-EECLASS/](https://laisiff-dev.github.io/AI-TEST-EECLASS/)
8. **內建 AI 出題 Prompt 助手**：
   - 提供大學專業課程、講義內容精準出題、期中期末考題型配比等多組經過驗證的 Prompt 模板，一鍵複製給 AI。
9. **提供 Python 批次處理腳本 (CLI)**：
   - 支援內建嚴格檢核模式（`--no-strict` 可選），適合批次處理大量文字檔題庫。

---

## 🖥️ 快速開始使用

### 方式一：使用現代化 Web 介面 (最推薦，適合所有人)

1. 在檔案總管中對著 [index.html](file:///f:/%E6%96%87%E4%BA%AE/ANTIGRAVITY/homework%E2%80%94%EF%BD%89%EF%BD%8D%EF%BD%90%EF%BD%8F%EF%BD%92%EF%BD%94/index.html) 點擊兩下，使用 Chrome、Edge 或任何瀏覽器開啟。
2. 或在終端機啟動本機伺服器：
   ```bash
   python -m http.server 8080
   ```
   並於瀏覽器訪問 `http://127.0.0.1:8080/index.html`。
3. **使用步驟**：
   - **步驟 1**：在「1. 貼上 AI 題目與解析」中貼上 AI 生成的題目（或點「📚 載入範例題」試用）。
   - **步驟 2**：點擊「🚀 立即智慧解析並預覽」，系統會自動切換至「2. 題目預覽與編輯」。
   - **步驟 3**：校對題幹與選項答案，可自由新增、修改或重新排序。
   - **步驟 4**：點擊右上角 **「📥 匯出 ee-class CSV」** 或 **「🎁 匯出 GIFT 格式」** 下載檔案。

---

### 方式二：使用 Python 命令列工具 (適合自動化批次轉檔)

系統內附 [convert_ai_to_eeclass.py](file:///f:/%E6%96%87%E4%BA%AE/ANTIGRAVITY/homework%E2%80%94%EF%BD%89%EF%BD%8D%EF%BD%90%EF%BD%8F%EF%BD%92%EF%BD%94/convert_ai_to_eeclass.py)：

```bash
# 轉為 ee-Class 專用 CSV 檔案 (預設)
python convert_ai_to_eeclass.py sample_ai_questions.txt -o my_quiz.csv

# 轉為 GIFT 格式檔案
python convert_ai_to_eeclass.py sample_ai_questions.txt --format gift -o my_quiz.gift
```

---

## 📤 ee-Class 匯入完整教學

當您下載好 `.csv` 或 `.gift` 檔案後：

1. 登入學校的 **ee-Class / TronClass** 系統，進入授課課程。
2. 點選 **「測驗」** &rarr; 建立新測驗或進入現有測驗編輯畫面。
3. 在題目列表畫面右側操作區，點擊 **「匯入」** 按鈕。
4. 在彈出視窗「匯入題目」中（如您截圖所示）：
   - 若為 CSV 檔案：點擊 **「CSV」** 圖示，選擇剛下載的 `.csv` 檔案。
   - 若為 GIFT 檔案：點擊 **「GIFT」** 圖示，選擇剛下載的 `.gift` 檔案。
5. 點擊確定上傳，系統將自動完成單選題、是非題、所有選項、正確答案與解析之建置！

---

## 📁 檔案結構說明

| 檔案名稱 | 說明 |
| :--- | :--- |
| [index.html](file:///f:/%E6%96%87%E4%BA%AE/ANTIGRAVITY/homework%E2%80%94%EF%BD%89%EF%BD%8D%EF%BD%90%EF%BD%8F%EF%BD%92%EF%BD%94/index.html) | 主應用程式網頁介面 (HTML5) |
| [style.css](file:///f:/%E6%96%87%E4%BA%AE/ANTIGRAVITY/homework%E2%80%94%EF%BD%89%EF%BD%8D%EF%BD%90%EF%BD%8F%EF%BD%92%EF%BD%94/style.css) | 玻璃擬態科技風現代 CSS 樣式庫 |
| [parser.js](file:///f:/%E6%96%87%E4%BA%AE/ANTIGRAVITY/homework%E2%80%94%EF%BD%89%EF%BD%8D%EF%BD%90%EF%BD%8F%EF%BD%92%EF%BD%94/parser.js) | AI 題目文本智慧解析引擎 (JavaScript) |
| [exporter.js](file:///f:/%E6%96%87%E4%BA%AE/ANTIGRAVITY/homework%E2%80%94%EF%BD%89%EF%BD%8D%EF%BD%90%EF%BD%8F%EF%BD%92%EF%BD%94/exporter.js) | ee-Class CSV (Version 4) 與 GIFT 匯出引擎 |
| [app.js](file:///f:/%E6%96%87%E4%BA%AE/ANTIGRAVITY/homework%E2%80%94%EF%BD%89%EF%BD%8D%EF%BD%90%EF%BD%8F%EF%BD%92%EF%BD%94/app.js) | 前端控制器、即時校驗、互動與 LocalStorage 自動存檔 |
| [convert_ai_to_eeclass.py](file:///f:/%E6%96%87%E4%BA%AE/ANTIGRAVITY/homework%E2%80%94%EF%BD%89%EF%BD%8D%EF%BD%90%EF%BD%8F%EF%BD%92%EF%BD%94/convert_ai_to_eeclass.py) | Python 命令列獨立轉檔腳本 |
| [sample_ai_questions.txt](file:///f:/%E6%96%87%E4%BA%AE/ANTIGRAVITY/homework%E2%80%94%EF%BD%89%EF%BD%8D%EF%BD%90%EF%BD%8F%EF%BD%92%EF%BD%94/sample_ai_questions.txt) | 測試用環境微生物學範例題庫 |
