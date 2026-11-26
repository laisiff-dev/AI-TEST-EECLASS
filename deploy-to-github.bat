@echo off
chcp 65001 >nul
title ee-Class 題目轉換系統 - GitHub 上傳與 Pages 部署工具

echo ======================================================================
echo    ee-Class 智慧題目轉換系統 Pro 2026 - GitHub & Pages 快速連接工具
echo ======================================================================
echo.

:: 1. 檢查 Git 是否已安裝
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [錯誤] 系統中未偵測到 Git 指令，請先安裝 Git for Windows (https://git-scm.com/)。
    pause
    exit /b 1
)

:: 2. 確認 Git 倉庫與分支
if not exist ".git" (
    echo [資訊] 正在初始化本地 Git 倉庫...
    git init -b main
) else (
    git branch -M main >nul 2>nul
)

:: 3. 檢查或設定 Remote Origin
git remote get-url origin >nul 2>nul
if %errorlevel% neq 0 (
    echo [提示] 尚未設定遠端 GitHub 倉庫 (Remote origin)。
    echo 請先在 GitHub 建立一個倉庫（例如名為 AI-TEST-EECLASS）。
    echo 預設範例：git@github.com:laisiff-dev/AI-TEST-EECLASS.git
    echo.
    set /p REPO_URL="請輸入您的 GitHub 倉庫網址 (直接按 Enter 套用預設): "
    if "%REPO_URL%"=="" (
        set REPO_URL=git@github.com:laisiff-dev/AI-TEST-EECLASS.git
    )
    echo.
    echo 正在關聯遠端倉庫：%REPO_URL% ...
    git remote add origin %REPO_URL%
) else (
    echo [資訊] 目前遠端 GitHub 倉庫：
    git remote -v
)

echo.
echo ======================================================================
echo 正在準備檔案並提交 (git add ^& commit)...
echo ======================================================================
git add -A
git status -s

set COMMIT_MSG=feat: ee-Class 智慧考題轉換系統 Pro 2026 - 淡色系列美化版面與 GitHub Pages 連接支援
git commit -m "%COMMIT_MSG%" >nul 2>nul
if %errorlevel% neq 0 (
    echo (本地檔案已是最新狀態，無需重複 commit)
) else (
    echo [成功] 本地變更已完成 commit！
)

echo.
echo ======================================================================
echo 正在推送至 GitHub (git push -u origin main)...
echo ======================================================================
git push -u origin main

if %errorlevel% neq 0 (
    echo.
    echo [注意事項] 推送失敗或需驗證。常見原因：
    echo 1. 首次推送到 GitHub 需登入身分驗證。
    echo 2. 遠端倉庫已有 README 或其他 commit，可嘗試執行：
    echo    git pull origin main --rebase
    echo    git push -u origin main
    echo 3. 若使用 SSH 金鑰或 Personal Access Token，請確認權限包含 repo 與 workflow。
) else (
    echo.
    echo ======================================================================
    echo  🎉 恭喜！專案已成功推送到 GitHub！
    echo ======================================================================
    echo.
    echo 📢 接下來啟用 GitHub Pages 只要 2 步驟：
    echo 1. 前往您的 GitHub 倉庫頁面 -> 點選上方 [Settings] (設定)
    echo 2. 點選左側選單 [Pages]
    echo 3. 在 [Build and deployment] 下方的 [Source] 選擇 [GitHub Actions]
    echo.
    echo 4. 本專案已內建 .github/workflows/deploy.yml 自動部署流程，
    echo    等待約 30 秒至 1 分鐘，您的網站即可於以下網址公開上線：
    echo    https://^<你的GitHub帳號^>.github.io/AI-TEST-EECLASS/
    echo ======================================================================
)

echo.
pause
