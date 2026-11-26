# ======================================================================
#  ee-Class 智慧題目轉換系統 Pro 2026 - GitHub & Pages 快速連接腳本
# ======================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "   ee-Class 智慧題目轉換系統 Pro 2026 - GitHub & Pages 快速連接工具" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. 檢查 Git 是否安裝
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "[錯誤] 系統中未偵測到 Git 指令，請先安裝 Git for Windows: https://git-scm.com/" -ForegroundColor Red
    exit 1
}

# 2. 初始化或切換 main 分支
if (-not (Test-Path ".git")) {
    Write-Host "[資訊] 正在初始化本地 Git 倉庫..." -ForegroundColor Green
    git init -b main
} else {
    git branch -M main 2>$null
}

# 3. 檢查或設定 Remote
$remoteUrl = git remote get-url origin 2>$null
if (-not $remoteUrl) {
    Write-Host "[提示] 尚未設定遠端 GitHub 倉庫 (Remote origin)。" -ForegroundColor Yellow
    Write-Host "預設範例：git@github.com:laisiff-dev/AI-TEST-EECLASS.git"
    $inputUrl = Read-Host "請輸入您的 GitHub 倉庫網址 (直接按 Enter 套用預設)"
    if ([string]::IsNullOrWhiteSpace($inputUrl)) {
        $inputUrl = "git@github.com:laisiff-dev/AI-TEST-EECLASS.git"
    }
    git remote add origin $inputUrl
    Write-Host "[成功] 已關聯遠端倉庫：$inputUrl" -ForegroundColor Green
} else {
    Write-Host "[資訊] 目前遠端 GitHub 倉庫：$remoteUrl" -ForegroundColor Cyan
}

# 4. 加入檔案並提交
Write-Host "`n正在準備檔案並提交 (git add & commit)..." -ForegroundColor Yellow
git add -A
git status -s

$commitMsg = "feat: ee-Class 智慧考題轉換系統 Pro 2026 - 淡色系列美化版面與 GitHub Pages 連接支援"
$commitResult = git commit -m "$commitMsg" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "[成功] 本地變更已完成 commit！" -ForegroundColor Green
} else {
    Write-Host "(本地檔案已是最新狀態，無需重複 commit)" -ForegroundColor Gray
}

# 5. 推送至 GitHub
Write-Host "`n正在推送至 GitHub (git push -u origin main)..." -ForegroundColor Yellow
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n======================================================================" -ForegroundColor Green
    Write-Host "  🎉 恭喜！專案已成功推送到 GitHub！" -ForegroundColor Green
    Write-Host "======================================================================" -ForegroundColor Green
    Write-Host "`n📢 啟用 GitHub Pages 只要 2 步驟：" -ForegroundColor White
    Write-Host "1. 前往 GitHub 倉庫頁面 -> 點選上方 [Settings] (設定)"
    Write-Host "2. 點選左側選單 [Pages]"
    Write-Host "3. 在 [Build and deployment] 下方的 [Source] 選擇 [GitHub Actions]"
    Write-Host "`n本專案已內建 .github/workflows/deploy.yml，約 30 秒至 1 分鐘後即可訪問！`n"
} else {
    Write-Host "`n[提醒] 推送未完成。若尚未登入 GitHub，請先登入憑證或使用 GitHub CLI: gh auth login" -ForegroundColor Yellow
}
