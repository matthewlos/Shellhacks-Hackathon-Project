#!/bin/zsh
# The whole Farm Hand site on this laptop, fed straight from the ESP32 over USB. No internet or Mac mini needed.
#   tools/local_site.sh        then open http://127.0.0.1:8120/farmhand/
# Builds the web app, starts cloud/receiver.py on 127.0.0.1:8120 with a laptop-only database, and runs
# tools/usb_bridge.py --local (it also keeps feeding the live site when there is internet).
set -e
HERE=${0:A:h}; ROOT=$HERE/..
PY=$ROOT/laya/.venv-mac/bin/python
TOKEN=$(sed -nE 's/^#define[[:space:]]+FARMHAND_TOKEN[[:space:]]+"([^"]*)".*/\1/p' $ROOT/firmware/sensors_live/include/secrets.h)
[ -n "$TOKEN" ] || { echo "FARMHAND_TOKEN not found in secrets.h"; exit 1; }
(cd $ROOT/web && npm run build --silent >/dev/null)
mkdir -p $ROOT/cloud/local
FARMHAND_TOKEN=$TOKEN SITE_DIR=$ROOT/web/dist FARMHAND_DB=$ROOT/cloud/local/farmhand_local.db $PY -u $ROOT/cloud/receiver.py &
SERVER=$!
trap "kill $SERVER 2>/dev/null" EXIT
sleep 1
echo "Local site: http://127.0.0.1:8120/farmhand/"
$PY $HERE/usb_bridge.py --local "$@"
