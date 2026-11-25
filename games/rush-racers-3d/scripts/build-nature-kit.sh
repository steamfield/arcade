#!/usr/bin/env bash
# Builds src/engine/assets/nature.glb from Quaternius's Stylized Nature MegaKit (CC0).
# Usage: scripts/build-nature-kit.sh <path to the kit's glTF folder>
# Download: https://opengameart.org/content/stylized-nature-megakit (Standard zip, glTF folder).
# Every model lands as a root node named after its file in one scene; textures are capped at
# 512 px (1024 for leaf cards) and WebP-encoded, geometry is meshopt-compressed.
# The final bake uses Playwright Chromium to make the low-tier cutout atlas from that exact glb.
set -euo pipefail
kit="${1:?path to the kit glTF folder}"
here="$(cd "$(dirname "$0")/.." && pwd)"
out="$here/src/engine/assets/nature.glb"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
gt() { pnpm dlx @gltf-transform/cli@4.5.1 "$@" >/dev/null; }

models=(
  Pine_1 Pine_2 Pine_3 Pine_4 Pine_5
  CommonTree_1 CommonTree_2 CommonTree_3 CommonTree_4 CommonTree_5
  DeadTree_1 DeadTree_2
  Bush_Common Bush_Common_Flowers
  Fern_1 Plant_1_Big Plant_7 Clover_1 Clover_2
  Flower_3_Group Flower_4_Group Mushroom_Common Mushroom_Laetiporus
  Grass_Common_Short Grass_Common_Tall Grass_Wispy_Short Grass_Wispy_Tall
  Rock_Medium_1 Rock_Medium_2 Rock_Medium_3
  Pebble_Round_1 Pebble_Round_2 Pebble_Round_3 Pebble_Square_1 Pebble_Square_2
)
inputs=()
for model in "${models[@]}"; do inputs+=("$kit/$model.gltf"); done
gt merge "${inputs[@]}" "$work/merged.glb" --merge-scenes
gt dedup "$work/merged.glb" "$work/dedup.glb"
gt prune "$work/dedup.glb" "$work/pruned.glb"
gt resize "$work/pruned.glb" "$work/small.glb" --width 512 --height 512 --pattern "Bark*"
gt resize "$work/small.glb" "$work/smaller.glb" --width 1024 --height 1024
gt webp "$work/smaller.glb" "$work/webp.glb" --quality 82
gt meshopt "$work/webp.glb" "$out"
node "$here/scripts/bake-forest.mjs"
pnpm dlx @gltf-transform/cli@4.5.1 inspect "$out" | grep -A40 TEXTURES | head -40
ls -l "$out"
