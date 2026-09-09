#!/usr/bin/env bash
# Regenerates Code.all-in-one.gs, the single file the user pastes into the
# Apps Script editor. Keeps the paste instructions on top and separates the
# two source files, so a plain `cat` never loses the banner again.
set -euo pipefail
cd "$(dirname "$0")"
{
  cat banner.txt
  echo
  cat Code.gs
  cat <<'SEP'

/* ---------------------------------------------------------------------------
 * The crest, as text. Everything below this line is one image - the amber
 * knockout of the shield, 132px wide, shown at 44px in the email header.
 * Nothing to read here; leave it alone.
 * ------------------------------------------------------------------------- */

SEP
  sed '1,/^ \*\//d' Logo.gs
} > Code.all-in-one.gs
echo "Code.all-in-one.gs rebuilt ($(wc -c < Code.all-in-one.gs) bytes)"
