@echo off
chcp 65001 >nul
setlocal enableextensions enabledelayedexpansion
cd /d "%~dp0"

REM ============================================================
REM  FlowOps ローカル起動 ^(SQLite / Docker不要^)
REM  - Node.js さえあれば他PCでもダブルクリックで動きます
REM  - 初回は自動で .env 作成 / 依存導入 / DB作成 / 初期データ投入
REM ============================================================

echo ============================================
echo   FlowOps ローカル起動 (SQLite / Docker不要)
echo ============================================
echo.

REM --- 1) Node.js の確認 -------------------------------------
where node >nul 2>nul
if errorlevel 1 (
  echo [エラー] Node.js が見つかりません。
  echo   https://nodejs.org/ から LTS 版をインストールし、PCを再起動してから
  echo   もう一度この start.bat をダブルクリックしてください。
  echo.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node -v') do set "NODEVER=%%v"
echo [OK] Node.js !NODEVER!

REM --- 2) .env を SQLite 構成で用意 --------------------------
REM    ※ DB も .env も git 管理外なので、無ければここで作る
set "DBCREATED="
if not exist ".env" (
  echo [setup] .env が無いので SQLite 構成で作成します...
  REM AUTH_SECRET をランダム生成^(失敗時は固定値^)
  set "GENSECRET="
  for /f "delims=" %%s in ('powershell -NoProfile -Command "[guid]::NewGuid().ToString('N')+[guid]::NewGuid().ToString('N')" 2^>nul') do set "GENSECRET=%%s"
  if not defined GENSECRET set "GENSECRET=dev-secret-please-change-me"
  >  ".env" echo # FlowOps ローカル最小構成 / SQLite / Docker不要
  >> ".env" echo DATABASE_URL="file:./prisma/dev.db"
  >> ".env" echo AUTH_SECRET=!GENSECRET!
  >> ".env" echo ALLOWED_ORIGINS=http://localhost:3000
  >> ".env" echo # LLM を使う機能を試す場合は下記を実際のキーに置き換えてください
  >> ".env" echo LLM_PROVIDER=openai
  >> ".env" echo LLM_API_KEY=sk-replace-with-your-key
  >> ".env" echo LLM_MODEL=gpt-4o
  echo [OK] .env を作成しました。
) else (
  echo [OK] .env は既に存在します。
)

REM --- 3) 依存パッケージ -------------------------------------
if not exist "node_modules" (
  echo [setup] 依存パッケージをインストール中... 数分かかる場合があります
  call npm install
  if errorlevel 1 (
    echo [エラー] npm install に失敗しました。ネットワークを確認して再実行してください。
    pause
    exit /b 1
  )
) else (
  echo [OK] node_modules は既に存在します。
)

REM --- 4) Prisma クライアント生成 ----------------------------
echo [setup] Prisma クライアントを生成中...
call npx prisma generate
if errorlevel 1 (
  echo [エラー] prisma generate に失敗しました。
  pause
  exit /b 1
)

REM --- 5) データベース ^(無ければ作成して初期データ投入^) -----
if not exist "prisma\dev.db" (
  echo [setup] データベースを作成中...
  call npx prisma db push
  if errorlevel 1 (
    echo [エラー] データベース作成 ^(prisma db push^) に失敗しました。
    pause
    exit /b 1
  )
  set "DBCREATED=1"
) else (
  echo [OK] データベースは既に存在します。
)

if defined DBCREATED (
  echo [setup] 初期データ ^(管理者ユーザー/サンプル^) を投入中...
  call npm run db:seed
  if errorlevel 1 (
    echo [警告] 初期データ投入に失敗しましたが、空のDBで続行します。
  )
)

REM --- 6) ブラウザを少し待ってから開く ----------------------
start "" cmd /c "timeout /t 7 >nul & start "" http://localhost:3000"

echo.
echo ============================================
echo   起動中: http://localhost:3000
echo   ログイン: admin@flowops.local / admin
echo   停止: このウィンドウを閉じる か Ctrl+C
echo ============================================
echo.

REM --- 7) 開発サーバー起動 ^(フォアグラウンド^) ---------------
call npm run dev

endlocal
