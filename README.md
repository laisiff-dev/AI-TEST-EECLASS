# ee-Class 智慧考題轉題庫整合系統 (AI-TEST-EECLASS × Tools_QB)

專為大專校院與技職教師設計的全格式 **考題與講義轉 ee-Class / TronClass 題庫系統**。深度整合 [Tools_QB](https://github.com/RelerChenTajen/Tools_QB) 官方 27 欄規格與原 **AI-TEST-EECLASS** 二段式智慧重構引擎，並加入 **離線 PDF.js 中文抽字、Excel (.xlsx) 直讀、Gemini AI 多模態解析（掃描 PDF / 考卷照片）與 PDF 講義一鍵出題**，免安裝軟體即可在瀏覽器完成所有轉換。

---

## 🌐 線上免安裝版 (GitHub Pages)

即開即用，電腦與行動裝置免安裝環境：
👉 **[https://laisiff-dev.github.io/AI-TEST-EECLASS/](https://laisiff-dev.github.io/AI-TEST-EECLASS/)**

---

## 🌟 整合強化特色

```
  📄 任何形態考題 / 講義              🤖 離線雙段引擎 ＋ Gemini AI             📊 ee-Class 題庫匯入檔
  PDF / Word / Excel / 照片   ──▶     智慧規格化、驗證與視覺化編輯    ──▶   1. ee-Class CSV (UTF-8 無BOM / BOM)
  NotebookLM / MD / TXT                                                    2. Big5 副本 CSV (CP950)
                                                                           3. Moodle / ee-Class GIFT (.gift)
                                                                           4. JSON 題庫備份還原
```

1. **📁 全格式考題匯入（離線免金鑰 ＋ AI 多模態雙引擎）**：
   - **PDF 檔案（文字型離線直讀 / 掃描型 AI 辨識）**：內建本機 PDF.js 引擎，文字型 PDF 免 API Key 離線抽字；純掃描圖片 PDF 自動切換 Gemini AI 視覺辨識。
   - **Word (`.docx`)**：離線直讀段落與表格（含解答表）。
   - **Excel (`.xlsx`)**：離線自動對應常見考題欄名或 27 欄標準表。
   - **考卷照片（`.jpg` / `.png` / `.webp`）**：透過 Gemini AI 多模態直接轉成結構化題目。
   - **純文字 / Markdown / CSV / JSON 備份**：自動偵測 UTF-8 與 Big5 編碼。
2. **🪄 二段式自由格式智慧重構引擎**：
   - 自動處理 **NotebookLM 黏合選項與來源引用編號**（如 `1(A)...(B)...`）＋ **卷中／卷末四欄 CSV 解答表**自動回填。
   - 支援傳統 Word 考卷：題首括號答案 `( C ) 1.` / `1. ( C )`、題末答案 `(對)`、圓圈選項 `①②③④`、底線填空 `_____(答案)`、多格填充 `【 1 】` 與多行問答參考答案。
3. **📄 PDF 講義轉 5 大題型出題助手**：
   - 於「4. AI 出題提示詞」分頁可直接拖入 **PDF / Word / 文字課程講義**，自訂是非、單選、複選、填充、問答配比，選擇**一鍵複製完整提示詞貼給網頁版 AI**，或用 **Gemini API 站內直接出題**並進入編輯器校對。
4. **🔍 CSV 驗收與一鍵轉 Big5 / GIFT**：
   - 針對 Gemini / Claude / ChatGPT 網頁版產出的 CSV，一秒檢查首列 `version: 4`、每列 27 欄結構與逐題錯誤，並可載入編輯器修復或一鍵轉存 Big5（自動等義替換 `≥→≧`、`≤→≦`、`・→‧` 並偵測缺字）。
5. **🎯 5 大題型完整支援與 5 種匯出格式**：
   - 嚴格符合 **ee-Class / TronClass Version 4 官方 27 欄規範**（與 `Tools_QB/sample.csv` 及 `sample_big5.csv` 逐位元一致），支援 UTF-8 無 BOM、UTF-8 BOM、Big5 (CP950)、GIFT (`.gift`) 與 JSON 備份。
6. **📖 內建完整教學**：
   - 整合 **ee-Class 平台匯入步驟** 與 **Gemini / Claude / ChatGPT 網頁版技能／外掛 7 步安裝檢核清單**。

---

## 🖥️ 使用方式

### 方式一：線上版或本機雙擊（最推薦）
1. 開啟 [GitHub Pages 線上版](https://laisiff-dev.github.io/AI-TEST-EECLASS/)，或下載本專案後直接雙擊 `index.html`（請保留 `lib/` 資料夾於同一目錄以支援離線 PDF 抽取）。
2. 在 **「1. 全格式匯入與解析」** 拖入考題檔或貼上題目（也可直接點選內建的 3 套範例體驗）。
3. 在 **「2. 題目編輯與匯出」** 核對題目、篩選／搜尋／調整閱讀字級，通過防呆驗證後一鍵下載 CSV（UTF-8 / Big5）或 GIFT。
4. 若要從課程講義出題，直接切換至 **「4. AI 出題提示詞」** 拖入 PDF／Word 講義即可。

### 方式二：Python 命令列工具（CLI 批次轉檔）
```bash
python convert_ai_to_eeclass.py exam.docx -o exam.csv --category "環境微生物學" --big5
python convert_ai_to_eeclass.py sample_ai_questions.txt --format gift -o my_quiz.gift
```

---

## 📁 主要檔案說明

| 檔案 / 資料夾 | 說明 |
| :--- | :--- |
| `index.html` | 整合式 5 分頁主應用程式（支援亮暗色主題與免安裝雙擊開啟） |
| `core.js` | 核心引擎（ZIP/DOCX/XLSX/PDF 抽取、二段式規格化、Gemini 多模態 API、27 欄防呆驗證、UTF-8/Big5/GIFT/JSON 匯出、CSV 驗收） |
| `app.js` | 前端互動控制器（全格式拖放、編輯器篩選搜尋字級、講義出題助手、進度清單） |
| `style.css` | 響應式樣式與亮暗色主題系統 |
| `lib/pdf.min.js`, `lib/pdf.worker.min.js` | Mozilla PDF.js 離線中文 PDF 解析套件 |
| `.github/workflows/deploy.yml` | GitHub Actions 自動部署至 GitHub Pages 工作流程 |
| `convert_ai_to_eeclass.py` | Python 命令列獨立轉檔工具 |
| `skill/exam-to-qb/` | Agent Skills 開放標準技能套件（Claude / Codex / Gemini CLI） |
