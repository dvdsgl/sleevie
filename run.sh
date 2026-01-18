#!/bin/bash
# Run the Sleeve now playing widget

# Set up paths for locally installed AGS/Astal libraries
export PATH="/home/david/.cache/.bun/bin:/usr/local/bin:$PATH"
export LD_LIBRARY_PATH="/usr/local/lib:$LD_LIBRARY_PATH"
export GI_TYPELIB_PATH="/usr/local/lib/girepository-1.0:$GI_TYPELIB_PATH"

# Run AGS with this project directory
cd "$(dirname "$0")"
exec ags run .
