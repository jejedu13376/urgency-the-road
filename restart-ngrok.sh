#!/usr/bin/env bash
# restart-ngrok.sh — keep ngrok → Metro :8081 alive; print exp:// URL
# Repo: urgency-the-road (Windows Git Bash / WSL / macOS / Linux)
set -u

PORT="${NGROK_PORT:-8081}"
API="${NGROK_API:-http://127.0.0.1:4040/api/tunnels}"
ROOT="$(cd "$(dirname "$0")" && pwd)"
LOG="${NGROK_LOG:-$ROOT/.ngrok-tunnel.log}"
PIDFILE="${NGROK_PIDFILE:-$ROOT/.ngrok-tunnel.pid}"

find_ngrok() {
  if command -v ngrok >/dev/null 2>&1; then
    command -v ngrok
    return 0
  fi
  # Expo-bundled binary (this repo)
  local win="$ROOT/node_modules/@expo/ngrok-bin-win32-x64/ngrok.exe"
  local linux="$ROOT/node_modules/@expo/ngrok-bin-linux-x64/ngrok"
  local mac="$ROOT/node_modules/@expo/ngrok-bin-darwin-x64/ngrok"
  local macarm="$ROOT/node_modules/@expo/ngrok-bin-darwin-arm64/ngrok"
  for c in "$win" "$linux" "$mac" "$macarm"; do
    if [[ -x "$c" || -f "$c" ]]; then
      echo "$c"
      return 0
    fi
  done
  # npx @expo/ngrok-bin shim
  if [[ -f "$ROOT/node_modules/@expo/ngrok-bin/bin/ngrok.js" ]] && command -v node >/dev/null 2>&1; then
    echo "node|$ROOT/node_modules/@expo/ngrok-bin/bin/ngrok.js"
    return 0
  fi
  return 1
}

kill_ngrok() {
  if [[ -f "$PIDFILE" ]]; then
    local old
    old="$(cat "$PIDFILE" 2>/dev/null || true)"
    if [[ -n "${old:-}" ]] && kill -0 "$old" 2>/dev/null; then
      kill "$old" 2>/dev/null || true
      sleep 0.5
      kill -9 "$old" 2>/dev/null || true
    fi
    rm -f "$PIDFILE"
  fi
  # Windows / Git Bash: also stop stray ngrok.exe
  if command -v taskkill.exe >/dev/null 2>&1; then
    taskkill.exe /F /IM ngrok.exe >/dev/null 2>&1 || true
  fi
  pkill -f '[n]grok http' 2>/dev/null || true
  pkill -x ngrok 2>/dev/null || true
  sleep 1
}

wait_ready() {
  local i=0
  while (( i < 60 )); do
    if curl -fsS "$API" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
    i=$((i + 1))
  done
  return 1
}

public_https() {
  # Prefer https public_url from ngrok local API
  if command -v python >/dev/null 2>&1 || command -v python3 >/dev/null 2>&1; then
    local py
    py="$(command -v python3 || command -v python)"
    "$py" - <<'PY' 2>/dev/null
import json, urllib.request
try:
    with urllib.request.urlopen("http://127.0.0.1:4040/api/tunnels", timeout=3) as r:
        data = json.load(r)
    for t in data.get("tunnels") or []:
        u = t.get("public_url") or ""
        if u.startswith("https://"):
            print(u)
            break
    else:
        for t in data.get("tunnels") or []:
            u = t.get("public_url") or ""
            if u.startswith("http://"):
                print(u)
                break
except Exception:
    pass
PY
    return 0
  fi
  curl -fsS "$API" 2>/dev/null | tr ',' '\n' | sed -n 's/.*"public_url":"\(https:[^"]*\)".*/\1/p' | head -n1
}

# Parse public URL from ngrok log (fallback while API tunnel list is empty)
public_https_from_log() {
  if [[ ! -f "$LOG" ]]; then
    return 0
  fi
  # Common ngrok lines: "url=https://….ngrok…" / "started tunnel … https://…"
  local from_log
  from_log="$(
    grep -Eo 'https://[a-zA-Z0-9._-]+\.(ngrok[^/[:space:]]*|exp\.direct)' "$LOG" 2>/dev/null \
      | tail -n1 || true
  )"
  if [[ -n "${from_log:-}" ]]; then
    echo "$from_log"
  fi
}

# Wait up to ~60s for public_url (poll every 2s via API 4040, then log).
# Status → stderr/log only; stdout is the URL alone (for capture).
wait_public_url() {
  local timeout_s="${NGROK_PUBLIC_URL_TIMEOUT_S:-60}"
  local interval_s="${NGROK_PUBLIC_URL_POLL_S:-2}"
  local elapsed=0
  local url=""

  {
    echo "[restart-ngrok] waiting for public_url (timeout=${timeout_s}s interval=${interval_s}s)"
  } | tee -a "$LOG" >&2
  while (( elapsed < timeout_s )); do
    url="$(public_https)"
    if [[ -z "${url:-}" ]]; then
      url="$(public_https_from_log)"
    fi
    if [[ -n "${url:-}" ]]; then
      echo "$url"
      return 0
    fi
    sleep "$interval_s"
    elapsed=$((elapsed + interval_s))
  done
  return 1
}

to_exp_url() {
  local https="$1"
  local host
  host="${https#https://}"
  host="${host#http://}"
  host="${host%%/*}"
  # Expo Go accepts exp://host (Metro on tunnel default https/443 → mapped to 8081)
  echo "exp://${host}"
}

tunnel_alive() {
  local pid="$1"
  if ! kill -0 "$pid" 2>/dev/null; then
    return 1
  fi
  local url
  url="$(public_https)"
  [[ -n "$url" ]] || return 1
  # Hit local API again; optional soft check that Metro still listens
  curl -fsS "$API" >/dev/null 2>&1 || return 1
  return 0
}

start_once() {
  local bin="$1"
  echo "[restart-ngrok] $(date '+%Y-%m-%d %H:%M:%S') starting ngrok http ${PORT}" | tee -a "$LOG"

  if [[ "$bin" == node\|* ]]; then
    local js="${bin#node|}"
    node "$js" http "$PORT" --log=stdout >>"$LOG" 2>&1 &
  else
    "$bin" http "$PORT" --log=stdout >>"$LOG" 2>&1 &
  fi
  local pid=$!
  echo "$pid" >"$PIDFILE"

  if ! wait_ready; then
    echo "[restart-ngrok] ERROR: ngrok API not ready on 4040 (see $LOG)" | tee -a "$LOG"
    return 1
  fi

  local https
  if ! https="$(wait_public_url)"; then
    echo "[restart-ngrok] ERROR: no public_url yet after ~60s (see $LOG)" | tee -a "$LOG"
    return 1
  fi

  local exp
  exp="$(to_exp_url "$https")"
  echo "[restart-ngrok] https: $https" | tee -a "$LOG"
  echo "[restart-ngrok] Expo Go URL:" | tee -a "$LOG"
  echo "$exp" | tee -a "$LOG"
  # Also write latest URL for other tools
  echo "$exp" >"$ROOT/.ngrok-exp-url.txt"
  echo "$https" >"$ROOT/.ngrok-https-url.txt"
  return 0
}

main() {
  local bin
  if ! bin="$(find_ngrok)"; then
    echo "ERROR: ngrok not found. Install ngrok or keep @expo/ngrok-bin in node_modules." >&2
    exit 1
  fi
  echo "[restart-ngrok] using: $bin" | tee -a "$LOG"
  echo "[restart-ngrok] log: $LOG" | tee -a "$LOG"

  while true; do
    kill_ngrok
    if start_once "$bin"; then
      local pid
      pid="$(cat "$PIDFILE" 2>/dev/null || true)"
      echo "[restart-ngrok] watching pid=${pid:-?} — restart on disconnect" | tee -a "$LOG"
      while [[ -n "${pid:-}" ]] && tunnel_alive "$pid"; do
        sleep 5
      done
      echo "[restart-ngrok] $(date '+%Y-%m-%d %H:%M:%S') disconnect detected — restarting" | tee -a "$LOG"
    else
      echo "[restart-ngrok] start failed — retry in 5s" | tee -a "$LOG"
      sleep 5
    fi
  done
}

main "$@"
