#!/bin/bash

# Update script for xmlplay instrument files
# Downloads all instrument files from https://wim.vree.org/js3/

set -e  # Exit on error

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENDOR_DIR="$ROOT_DIR/vendor/xmlplay"
PUBLIC_DIR="$ROOT_DIR/public/js3"
BASE_URL="https://wim.vree.org/js3"

# List of all available instruments
INSTRUMENTS=("instr0mp3.js" "instr14mp3.js" "instr25mp3.js" "instr32mp3.js")

echo "=== Instrument Files Update Script ==="
echo "Updating all instrument files..."
echo ""

# Function to update a single instrument
update_instrument() {
  local instrument_file="$1"
  local main_url="$BASE_URL/$instrument_file"
  local fallback_url="$BASE_URL/jssf_files/$instrument_file"
  
  echo "Updating $instrument_file..."
  
  # Try main URL first
  echo "Downloading from: $main_url"
  echo "  → Attempting to download..."
  
  # Download to vendor directory
  echo "  → Downloading to vendor/xmlplay/$instrument_file"
  if curl -L -f -k -o "$VENDOR_DIR/$instrument_file" "$main_url"; then
    echo "✓ Successfully downloaded from main URL"
  else
    echo "⚠ Main URL failed, trying fallback URL..."
    echo "Fallback URL: $fallback_url"
    echo "  → Downloading to vendor/xmlplay/$instrument_file"
    
    if ! curl -L -f -k -o "$VENDOR_DIR/$instrument_file" "$fallback_url"; then
      echo "❌ Error: Failed to download from both main and fallback URLs"
      echo "  Main: $main_url"
      echo "  Fallback: $fallback_url"
      return 1
    fi
    echo "✓ Successfully downloaded from fallback URL"
  fi
  
  # Copy to public directory
  echo "  → Copying to public/js3/$instrument_file"
  mkdir -p "$PUBLIC_DIR"
  rm "$PUBLIC_DIR/$instrument_file"
  ln -s "../../vendor/xmlplay/$instrument_file" "$PUBLIC_DIR/$instrument_file"
  
  echo "✓ Successfully updated $instrument_file"
  echo ""
  
  return 0
}

# Create directories if they don't exist
mkdir -p "$VENDOR_DIR"
mkdir -p "$PUBLIC_DIR"

# Update all instruments
UPDATED_COUNT=0
FAILED_COUNT=0

for instr in "${INSTRUMENTS[@]}"; do
  if update_instrument "$instr"; then
    ((UPDATED_COUNT++))
  else
    ((FAILED_COUNT++))
  fi
done

echo "=== Summary ==="
echo "✓ Successfully updated: $UPDATED_COUNT file(s)"
if [ $FAILED_COUNT -gt 0 ]; then
  echo "❌ Failed to update: $FAILED_COUNT file(s)"
  exit 1
fi

echo ""
echo "✓ All instrument files updated successfully!"