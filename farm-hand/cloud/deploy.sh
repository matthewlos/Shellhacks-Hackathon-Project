#!/bin/zsh
# Pull the site from GitHub (public repo: no credentials), build it, swap it in. Old site stays up if a build fails.
set -u
ROOT="$HOME/farmhand-site"; cd "$ROOT"; source ./deploy.conf
export PATH=/opt/homebrew/bin:/usr/bin:/bin
LOG="$ROOT/deploy.log"
log(){ echo "$(date "+%F %T") $*" >> "$LOG"; }
[ -d "$ROOT/repo/.git" ] || { git clone -q --branch "$BRANCH" "$REPO" "$ROOT/repo" || { log "clone failed"; exit 1; }; }
cd "$ROOT/repo"
git fetch -q origin "$BRANCH" || { log "fetch failed"; exit 1; }
NEW=$(git rev-parse "origin/$BRANCH"); OLD=$(cat "$ROOT/deployed_sha" 2>/dev/null || echo none)
[ "$NEW" = "$OLD" ] && [ -d "$ROOT/current" ] && exit 0
git checkout -q -B "$BRANCH" "origin/$BRANCH" && git reset -q --hard "origin/$BRANCH"
cd "$ROOT/repo/$APP_DIR" || { log "no $APP_DIR in ${NEW:0:7}"; exit 1; }
if ! { npm ci --no-audit --no-fund --loglevel=error >> "$LOG" 2>&1 || npm install --no-audit --no-fund --loglevel=error >> "$LOG" 2>&1; } || ! npm run build >> "$LOG" 2>&1; then
  log "BUILD FAILED at ${NEW:0:7}, still serving ${OLD:0:7}"; exit 1
fi
rm -rf "$ROOT/next" && cp -R dist "$ROOT/next"
rm -rf "$ROOT/previous"; [ -d "$ROOT/current" ] && mv "$ROOT/current" "$ROOT/previous"; mv "$ROOT/next" "$ROOT/current"
echo "$NEW" > "$ROOT/deployed_sha"
log "deployed ${NEW:0:7} ($(git -C "$ROOT/repo" log -1 --format="%an: %s" | cut -c1-80))"
