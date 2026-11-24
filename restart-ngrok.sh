#!/usr/bin/env bash
# restart-ngrok.sh — one-shot: kill ngrok, tunnel :8081, print public URL, exit.
# Usage (Git Bash): ./restart-ngrok.sh
set -euo pipefail

PORT="${NGROK_PORT:-8081}"
API="http://127.0.0.1:4040/api/tunnels"
ROOT="$(cd "$(dirname "$0")" && pwd)"
TIMEOUT_S="${NGROK_PUBLIC_URL_TIMEOUT_S:-90}"
POLL_S="${NGROK_PUBLIC_URL_POLL_S:-3}"
LOG="${NGROK_LOG:-$ROOT/.ngrok-tunnel.log}"
PIDFILE="${NGROK_PIDFILE:-$ROOT/.ngrok-tunnel.pid}"

find_ngrok() {
  if command -v ngrok >/dev/null 2>&1; then
    command -v ngrok
    return 0
  fi
  local win="$ROOT/node_modules/@expo/ngrok-bin-win32-x64/ngrok.exe"
  if [[ -f "$win" ]]; then
    echo "$win"
    return 0
  fi
  return 1
}

kill_all_ngrok() {
  if [[ -f "$PIDFILE" ]]; then
    local old
    old="$(cat "$PIDFILE" 2>/dev/null || true)"
    if [[ -n "${old:-}" ]]; then
      kill "$old" 2>/dev/null || true
      sleep 0.3
      kill -9 "$old" 2>/dev/null || true
    fi
    rm -f "$PIDFILE"
  fi
  if command -v taskkill.exe >/dev/null 2>&1; then
    taskkill.exe /F /IM ngrok.exe >/dev/null 2>&1 || true
  fi
  pkill -x ngrok 2>/dev/null || true
  pkill -f '[n]grok http' 2>/dev/null || true
  sleep 1
}

public_https() {
  curl -fsS --max-time 3 "$API" 2>/dev/null \
    | tr ',' '\n' \
    | sed -n 's/.*"public_url"[[:space:]]*:[[:space:]]*"\(https:[^"]*\)".*/\1/p' \
    | head -n1
}

echo "[restart-ngrok] root=$ROOT port=$PORT"

BIN="$(find_ngrok)" || {
  echo "ERROR: ngrok introuvable (PATH ou $ROOT/node_modules/@expo/ngrok-bin-win32-x64/ngrok.exe)." >&2
  exit 1
}
echo "[restart-ngrok] binary=$BIN"

echo "[restart-ngrok] killing existing ngrok…"
kill_all_ngrok

: >"$LOG"
echo "[restart-ngrok] starting: $BIN http $PORT"
"$BIN" http "$PORT" --log=stdout >>"$LOG" 2>&1 &
NGROK_PID=$!
echo "$NGROK_PID" >"$PIDFILE"
echo "[restart-ngrok] pid=$NGROK_PID  log=$LOG"

echo "[restart-ngrok] waiting for public_url (timeout=${TIMEOUT_S}s poll=${POLL_S}s API=$API)"
elapsed=0
HTTPS_URL=""
while (( elapsed < TIMEOUT_S )); do
  if ! kill -0 "$NGROK_PID" 2>/dev/null; then
    echo "ERROR: ngrok process exited before publishing a URL (pid=$NGROK_PID)." >&2
    echo "--- last log lines ---" >&2
    tail -n 40 "$LOG" 2>/dev/null >&2 || true
    rm -f "$PIDFILE"
    exit 1
  fi
  HTTPS_URL="$(public_https || true)"
  if [[ -n "${HTTPS_URL:-}" ]]; then
    break
  fi
  sleep "$POLL_S"
  elapsed=$((elapsed + POLL_S))
done

if [[ -z "${HTTPS_URL:-}" ]]; then
  echo "ERROR: pas d'URL publique après ${TIMEOUT_S}s (API $API vide)." >&2
  echo "Vérifie: Metro sur :$PORT, ngrok authtoken, et $LOG" >&2
  echo "--- last log lines ---" >&2
  tail -n 40 "$LOG" 2>/dev/null >&2 || true
  exit 1
fi

HOST="${HTTPS_URL#https://}"
HOST="${HOST#http://}"
HOST="${HOST%%/*}"
EXP_URL="exp://${HOST}"

echo ""
echo "========================================"
echo "  https:  $HTTPS_URL"
echo "  exp://  $EXP_URL"
echo "========================================"
echo ""

echo "$HTTPS_URL" >"$ROOT/.ngrok-https-url.txt"
echo "$EXP_URL" >"$ROOT/.ngrok-exp-url.txt"

exit 0
