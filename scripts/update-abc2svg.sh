#!/bin/bash

# Update script for abc2svg
# Downloads the latest version from https://chiselapp.com/user/moinejf/repository/abc2svg
# Builds the source files and updates vendor directory

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENDOR_DIR="$SCRIPT_DIR/vendor/abc2svg"
TMP_DIR="$SCRIPT_DIR/.tmp-abc2svg-update"
TARBALL_URL="https://chiselapp.com/user/moinejf/repository/abc2svg/tarball/abc2svg.tar.gz?uuid=trunk"

# Files to update
FILES_TO_UPDATE=("abc2svg-1.js" "chordnames-1.js" "MIDI-1.js" "strtab-1.js")

echo "=== abc2svg Update Script ==="
echo ""

# Clean up function
cleanup() {
  if [ -d "$TMP_DIR" ]; then
    echo "Cleaning up temporary files..."
    rm -rf "$TMP_DIR"
  fi
}

# Set trap to cleanup on exit
trap cleanup EXIT

# Create temporary directory
if [ -d "$TMP_DIR" ]; then
  rm -rf "$TMP_DIR"
fi
mkdir -p "$TMP_DIR"

# Download tarball
echo "Downloading from $TARBALL_URL..."
TARBALL_PATH="$TMP_DIR/abc2svg.tar.gz"
curl -L -o "$TARBALL_PATH" "$TARBALL_URL"
echo "✓ Download complete"
echo ""

# Extract tarball
echo "Extracting tarball to $TMP_DIR..."
tar -xzf "$TARBALL_PATH" -C "$TMP_DIR"
echo "✓ Extraction complete"
echo ""

# Find the extracted directory
SOURCE_DIR=$(find "$TMP_DIR" -maxdepth 1 -type d ! -path "$TMP_DIR" | head -n 1)

if [ -z "$SOURCE_DIR" ]; then
  echo "Error: Could not find extracted directory"
  exit 1
fi

echo "Found source directory: $SOURCE_DIR"
echo ""

# Build abc2svg from source
echo "Building abc2svg from source..."
cd "$SOURCE_DIR"

if [ ! -f "./build" ]; then
  echo "Error: ./build script not found"
  exit 1
fi

chmod +x ./build
NOMIN=1 ./build

echo "✓ Build complete"
echo ""

cd "$SCRIPT_DIR"

# Ensure vendor directory exists
mkdir -p "$VENDOR_DIR"

# Copy built files
echo "Copying built files..."
COPIED_COUNT=0

for file in "${FILES_TO_UPDATE[@]}"; do
  SOURCE_PATH="$SOURCE_DIR/$file"
  DEST_PATH="$VENDOR_DIR/$file"
  
  if [ -f "$SOURCE_PATH" ]; then
    cp "$SOURCE_PATH" "$DEST_PATH"
    echo "✓ Updated $file"
    ((COPIED_COUNT++))
  else
    echo "⚠ Warning: $file not found in build output"
  fi
done

echo ""

echo "✓ Update complete! Updated $COPIED_COUNT file(s)."
echo ""
echo "💡 To create/update the bundle, run: ./scripts/create-abc2svg-bundle.sh"
