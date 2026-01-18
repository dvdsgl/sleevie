#!/bin/bash
# Run the Sleevie now playing widget

# Set up paths for locally installed AGS/Astal libraries
export PATH="$HOME/.cache/.bun/bin:/usr/local/bin:$PATH"
export LD_LIBRARY_PATH="/usr/local/lib:$LD_LIBRARY_PATH"
export GI_TYPELIB_PATH="/usr/local/lib/girepository-1.0:$GI_TYPELIB_PATH"

# Run AGS with this project directory
cd "$(dirname "$0")"

# Start AGS in background
ags run . &
AGS_PID=$!

# Wait for window to appear (up to 5 seconds)
for i in {1..50}; do
  if hyprctl clients | grep -q "io.Astal.sleevie"; then
    sleep 0.1  # Small extra delay for window to be fully ready
    # Hide window while positioning
    hyprctl setprop class:io.Astal.sleevie alpha 0 2>/dev/null
    hyprctl dispatch pin class:io.Astal.sleevie 2>/dev/null
    hyprctl dispatch movewindowpixel exact 1220 680,class:io.Astal.sleevie 2>/dev/null
    sleep 0.05
    # Reveal window in final position
    hyprctl setprop class:io.Astal.sleevie alpha 1 2>/dev/null
    break
  fi
  sleep 0.1
done

# Wait for AGS process
wait $AGS_PID
