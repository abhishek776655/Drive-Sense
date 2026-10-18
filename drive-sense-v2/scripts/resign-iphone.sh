#!/bin/zsh
# Rebuilds DriveSense in Release and installs it on the iPhone over Wi-Fi, so the free Apple ID's
# 7-day signature never runs out. Run by launchd (~/Library/LaunchAgents/com.drivesense.resign.plist)
# on Wednesday and Sunday nights; safe to run by hand too:  ./scripts/resign-iphone.sh
#
# Needs: the Mac awake and signed in to Xcode with the Apple ID, the iPhone on the same Wi-Fi with
# Developer Mode on (unlocked or charging is most reliable). The API address baked into the build is
# whatever EXPO_PUBLIC_API_BASE_URL in .env.local says at the time.

set -u

# launchd starts with a bare environment.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
export CI=1

DEVICE="${DRIVESENSE_DEVICE:-00008120-000A195C36E2201E}"
APP_DIR="${0:A:h:h}"
LOG_DIR="$HOME/Library/Logs/DriveSense"
LOG="$LOG_DIR/resign-$(date +%Y-%m-%d_%H%M).log"
mkdir -p "$LOG_DIR"
# Keep the last 10 logs.
ls -1t "$LOG_DIR"/resign-*.log 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null

notify() {
  osascript -e "display notification \"$2\" with title \"DriveSense\" subtitle \"$1\"" >/dev/null 2>&1
}

# Run by hand: also show progress in the terminal. Run by launchd: the log only.
if [[ -t 1 ]]; then
  exec > >(tee -a "$LOG") 2>&1
else
  exec >>"$LOG" 2>&1
fi

{
  echo "== $(date) · device $DEVICE · $APP_DIR"
  cd "$APP_DIR" || exit 1

  # The phone must be reachable over the network first; a clear message beats a long build failure.
  if ! xcrun devicectl list devices 2>/dev/null | grep "$DEVICE" | grep -qE "available|connected"; then
    echo "iPhone not reachable over Wi-Fi."
    notify "Re-sign skipped" "iPhone not on the same Wi-Fi. Run scripts/resign-iphone.sh later."
    exit 2
  fi

  if npx expo run:ios --device "$DEVICE" --configuration Release --no-bundler; then
    echo "== installed $(date)"
    notify "App re-signed" "Installed on your iPhone; good for another 7 days."
  else
    echo "== FAILED $(date)"
    notify "Re-sign failed" "See $LOG"
    exit 1
  fi
}
