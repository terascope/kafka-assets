#!/usr/bin/env bash

set -e -u

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"
SRCDIR="${DIR}/.."

# Make sure the output dir exists
OUTDIR="${SRCDIR}/builds"
mkdir -p "$OUTDIR"

# Generate the asset name
ASSETNAME="$(node "${DIR}/asset-name.js")"
#echo "Output asset to be named: $ASSETNAME"

# Create the tempdir
TMPDIR="$(mktemp -d)"
# echo $TMPDIR

# Run build script
yarn --cwd "${SRCDIR}" run build

# Copy the source to the tmpdir
cp -a "${SRCDIR}" "${TMPDIR}"

# Remove any old node_modules to make sure they get updated
rm -rf "${TMPDIR}/asset/node_modules"

# Build and install asset dependencies
cd "${TMPDIR}/asset" || exit

# Run yarn install
yarn --prod --silent --no-progress

# Exclude asset src
rm -rf "${TMPDIR}/asset/src"

# Zip up generated asset directory
cd ..
zip -q -r -9 "$TMPDIR/$ASSETNAME" asset

mv "$TMPDIR/$ASSETNAME" "$OUTDIR/$ASSETNAME"

zipinfo "$OUTDIR/$ASSETNAME" | grep -v 'node_modules'

ASSET_FINAL_SIZE="$(ls -lah "$OUTDIR/$ASSETNAME" | awk '{print $5}')"

echo ''
echo "BUILT! name: \"$ASSETNAME\" size: $ASSET_FINAL_SIZE"

# Cleanup
rm -rf "$TMPDIR"
