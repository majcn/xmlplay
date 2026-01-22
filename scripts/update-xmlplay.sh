#!/bin/bash

# Update script for xmlplay
# Downloads the latest version from https://wim.vree.org/js3/xmlplay_index.html

set -e  # Exit on error

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENDOR_DIR="$ROOT_DIR/vendor/xmlplay"
TMP_DIR="$ROOT_DIR/.tmp-xmlplay-update"
BASE_URL="https://wim.vree.org/js3"
INDEX_URL="$BASE_URL/xmlplay_index.html"

echo "=== xmlplay Update Script ==="
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

# Find the latest version from the index page
echo "Finding latest version..."
ZIP_FILE=$(curl -s "$INDEX_URL" | grep -o 'xmlplay_[0-9]*\.zip' | head -1)

if [ -z "$ZIP_FILE" ]; then
  echo "Error: Could not find xmlplay zip file on $INDEX_URL"
  exit 1
fi

VERSION=$(echo "$ZIP_FILE" | grep -o '[0-9]*')
echo "Found version: $VERSION ($ZIP_FILE)"
echo ""

# Download zip file
ZIP_URL="$BASE_URL/$ZIP_FILE"
ZIP_PATH="$TMP_DIR/$ZIP_FILE"

echo "Downloading from $ZIP_URL..."
curl -L -o "$ZIP_PATH" "$ZIP_URL"
echo "✓ Download complete"
echo ""

# Extract zip file
echo "Extracting $ZIP_FILE to $TMP_DIR..."
unzip -q "$ZIP_PATH" -d "$TMP_DIR"
echo "✓ Extraction complete"
echo ""

# Find the extracted directory (xmlplay_NNN)
EXTRACTED_DIR=$(find "$TMP_DIR" -maxdepth 1 -type d -name "xmlplay_*" | head -1)

if [ -z "$EXTRACTED_DIR" ]; then
  echo "Error: Could not find xmlplay_* directory"
  ls -la "$TMP_DIR"
  exit 1
fi

SOURCE_DIR="$EXTRACTED_DIR/full_source"

if [ ! -d "$SOURCE_DIR" ]; then
  echo "Error: Could not find full_source directory in $EXTRACTED_DIR"
  ls -la "$EXTRACTED_DIR"
  exit 1
fi

echo "Found source directory: $SOURCE_DIR"
echo ""

# Ensure vendor directory exists
mkdir -p "$VENDOR_DIR"

# Copy files from full_source to vendor/xmlplay (excluding xmlplay_emb.js)
echo "Copying files to vendor/xmlplay..."
for file in "$SOURCE_DIR"/*; do
  filename=$(basename "$file")
  if [ "$filename" != "xmlplay_emb.js" ]; then
    cp "$file" "$VENDOR_DIR/"
  fi
done
echo "✓ Copied files from full_source (excluding xmlplay_emb.js)"

# Copy xmlplay.html to root
if [ -f "$EXTRACTED_DIR/xmlplay.html" ]; then
  cp "$EXTRACTED_DIR/xmlplay.html" "$ROOT_DIR/xmlplay.html"
  echo "✓ Copied xmlplay.html to root"
fi

echo ""
echo "✓ Update complete! Updated to xmlplay version $VERSION"
