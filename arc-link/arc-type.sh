#!/bin/bash
# ARC Type — makes the Mac a real keyboard + mouse for the tablet over USB.
# Gives Windows-style Alt+Tab (hold ⌥, tab through apps, release to switch), native autocomplete,
# reliable word-delete and umlauts. No video window (your screen stays off). One cable, USB debugging on.
#
#   curl -O https://architect-dna.ch/arc-link/arc-type.sh && bash arc-type.sh
#
# Keys on the tablet: ⌥Tab = app switcher (Windows style) · ⌘Space can't be used here, use the
# on-screen search. Quit: close this terminal or Ctrl-C.

command -v scrcpy >/dev/null || { echo "Installing scrcpy (one time)…"; brew install scrcpy; }

echo "ARC Type — Mac keyboard+mouse for the tablet. Hold ⌥ and press Tab to switch apps, like Windows."
echo "Keep the Pad plugged in. Ctrl-C to stop."

# --keyboard=uhid: the tablet sees a real USB keyboard → Android's own Alt+Tab switcher.
# --mouse=uhid: trackpad as a real mouse.  --no-video/--no-audio: nothing on the Mac screen.
exec scrcpy --keyboard=uhid --mouse=uhid --no-video --no-audio --stay-awake
