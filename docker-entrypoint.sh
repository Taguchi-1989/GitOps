#!/bin/sh
set -e

echo "============================================"
echo "  FlowOps - Starting up..."
echo "============================================"

# ── Step 1: Ensure data directory exists ────────────────────
mkdir -p /app/data

# ── Step 2: Initialize spec directory ───────────────────────
if [ ! -d "/app/spec/flows" ] || [ -z "$(ls -A /app/spec/flows 2>/dev/null)" ]; then
  echo "[init] Copying default spec files..."
  cp -r /app/spec.default/* /app/spec/
  echo "[init] Default spec files copied."
else
  echo "[init] Existing spec data found, skipping copy."
fi

if [ ! -d "/app/spec/dictionary" ]; then
  echo "[init] Copying default dictionary..."
  mkdir -p /app/spec/dictionary
  if [ -d "/app/spec.default/dictionary" ]; then
    cp -r /app/spec.default/dictionary/* /app/spec/dictionary/
  fi
fi

# ── Step 3: Initialize Git repository ───────────────────────
# Check for HEAD file (not just directory) because Docker volume mount creates empty .git/
git config --global user.email "flowops@local"
git config --global user.name "FlowOps"
git config --global init.defaultBranch main
if [ ! -f "/app/.git/HEAD" ]; then
  echo "[init] Initializing Git repository..."
  git init /app

  # Create .gitignore for the container's repo
  cat > /app/.gitignore << 'GITIGNORE'
node_modules/
.next/
data/
*.db
*.db-journal
GITIGNORE

  cd /app
  git add spec/ .gitignore
  git commit -m "Initial commit: seed flow definitions" --allow-empty || true
  echo "[init] Git repository initialized with 'main' branch."
else
  echo "[init] Existing Git repository found."
fi

# ── Step 4: Database setup ──────────────────────────────────
echo "[init] Running Prisma DB push..."
cd /app
node ./node_modules/prisma/build/index.js db push --skip-generate 2>&1 || {
  echo "[init] WARNING: prisma db push failed, retrying..."
  sleep 2
  node ./node_modules/prisma/build/index.js db push --skip-generate
}
echo "[init] Database ready."

# ── Step 5: Start Next.js ──────────────────────────────────
echo "[init] Starting Next.js server on port ${PORT:-3000}..."
echo "============================================"
exec node server.js
