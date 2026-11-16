#!/bin/bash
# ARC Type — Mac keyboard + trackpad as a REAL keyboard/mouse for the tablet (OTG/HID over USB).
# Windows-style Alt+Tab (hold ⌥, tab, release), native autocomplete, word-delete, umlauts.
#
#   bash arc-type.sh
#
# A small ARC Type window opens. CLICK IT ONCE to capture the keyboard, then type — it all goes
# to the tablet. Move the mouse back to the Mac by clicking another app (or press the left ⌥ twice).
# Needs: Pad plugged in, USB debugging on. Quit: close the window or Ctrl-C.

command -v scrcpy >/dev/null || { echo "Installing scrcpy (one time)…"; brew install scrcpy; }

echo "ARC Type — click the small window once, then hold ⌥ and press Tab to switch apps (Windows style)."
echo "Pad must be plugged in. Ctrl-C to stop."

# --otg: no screen mirroring, the Mac acts purely as a USB keyboard+mouse for the tablet.
exec scrcpy --otg --window-title="ARC Type — click me, then type"
