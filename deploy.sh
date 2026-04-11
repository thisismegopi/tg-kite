#!/bin/bash

set -e  # Exit immediately on error

# ─────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────
BRANCH="master"           # Change to your target branch
APP_DIR="$(pwd)"        # Change to your project path if needed
PM2_APP_ID=0            # PM2 app ID or name

# ─────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────
log()  { echo -e "\n\033[1;34m[DEPLOY]\033[0m $1"; }
ok()   { echo -e "\033[1;32m[OK]\033[0m $1"; }
fail() { echo -e "\033[1;31m[FAIL]\033[0m $1"; exit 1; }

# ─────────────────────────────────────────
# Step 0 — Stop PM2 process
# ─────────────────────────────────────────
log "Step 0: Stopping PM2 app (ID: $PM2_APP_ID)..."
pm2 stop "$PM2_APP_ID" || fail "pm2 stop failed"

ok "Server stopped successfully."

# ─────────────────────────────────────────
# Step 1 — Pull latest changes from GitHub
# ─────────────────────────────────────────
log "Step 1: Pulling latest changes from branch '$BRANCH'..."
cd "$APP_DIR" || fail "Project directory not found: $APP_DIR"

git fetch origin || fail "git fetch failed"
git checkout "$BRANCH" || fail "git checkout failed"
git pull origin "$BRANCH" || fail "git pull failed"

ok "Code updated successfully."

# ─────────────────────────────────────────
# Step 2 — Install dependencies & build
# ─────────────────────────────────────────
log "Step 2: Installing dependencies..."
npm install || fail "npm install failed"

log "Building project..."
npm run build || fail "npm run build failed"

ok "Build completed successfully."

# ─────────────────────────────────────────
# Step 3 — Restart server with PM2
# ─────────────────────────────────────────
log "Step 3: Restarting PM2 app (ID: $PM2_APP_ID)..."
pm2 start "$PM2_APP_ID" || fail "pm2 start failed"

ok "Server started successfully."

# ─────────────────────────────────────────
# Done
# ─────────────────────────────────────────
echo -e "\n\033[1;32m✔ Deployment complete!\033[0m"
pm2 status