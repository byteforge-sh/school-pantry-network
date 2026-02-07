#!/usr/bin/env bash
set -euo pipefail

# Build map-ready GeoJSON from a DPS geodata snapshot.
# Usage: build-data.sh <snapshot-dir>
#
# The snapshot dir must contain the expected DPS geodata structure:
#   regions.geojson, schools/{elementary,middle,high}.geojson,
#   boundaries/{es,ms,hs}-proposed-24-25.geojson

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/../data"

if [[ $# -lt 1 ]]; then
  echo "Usage: build-data.sh <snapshot-dir>" >&2
  echo "  e.g. build-data.sh /path/to/dps-school-geodata/snapshots/2026-02-07" >&2
  exit 1
fi

SNAPSHOT_DIR="$1"

# Verify the snapshot has what we need
REQUIRED_FILES=(
  "regions.geojson"
  "schools/elementary.geojson"
  "schools/middle.geojson"
  "schools/high.geojson"
  "boundaries/es-proposed-24-25.geojson"
  "boundaries/ms-proposed-24-25.geojson"
  "boundaries/hs-proposed-24-25.geojson"
)

for f in "${REQUIRED_FILES[@]}"; do
  if [[ ! -f "$SNAPSHOT_DIR/$f" ]]; then
    echo "ERROR: Missing required file: $SNAPSHOT_DIR/$f" >&2
    exit 1
  fi
done

echo "Snapshot: $SNAPSHOT_DIR"
mkdir -p "$OUTPUT_DIR"

# --- regions.geojson ---
echo "  -> regions.geojson"
jq '{
  type: .type,
  features: [.features[] | {
    type: .type,
    geometry: .geometry,
    properties: .properties | {Region, mont, ib, yr1, yr2, dli, mont_ms1, mont_ms2, ib_ms, dli_ms, arts_ms, yr_ms}
  }]
}' "$SNAPSHOT_DIR/regions.geojson" > "$OUTPUT_DIR/regions.geojson"

# --- boundaries-es.geojson ---
echo "  -> boundaries-es.geojson"
jq '{
  type: .type,
  features: [.features[] | {
    type: .type,
    geometry: .geometry,
    properties: .properties | {school_nam, pct_isp_21, cap_hb90_p, enroll_m2_, region, calendar, choice}
  }]
}' "$SNAPSHOT_DIR/boundaries/es-proposed-24-25.geojson" > "$OUTPUT_DIR/boundaries-es.geojson"

# --- boundaries-ms.geojson ---
echo "  -> boundaries-ms.geojson"
jq '{
  type: .type,
  features: [.features[] | {
    type: .type,
    geometry: .geometry,
    properties: .properties | {sch_name, choice_prg}
  }]
}' "$SNAPSHOT_DIR/boundaries/ms-proposed-24-25.geojson" > "$OUTPUT_DIR/boundaries-ms.geojson"

# --- boundaries-hs.geojson ---
echo "  -> boundaries-hs.geojson"
jq '{
  type: .type,
  features: [.features[] | {
    type: .type,
    geometry: .geometry,
    properties: .properties | {sch_name, choice_prg}
  }]
}' "$SNAPSHOT_DIR/boundaries/hs-proposed-24-25.geojson" > "$OUTPUT_DIR/boundaries-hs.geojson"

# --- schools-es.geojson (enriched with boundary data) ---
echo "  -> schools-es.geojson (enriched)"

# Build a lookup from boundary data: school_nam -> {pct_isp_21, enroll_m2_, calendar}
BOUNDARY_LOOKUP=$(jq '[.features[].properties | {key: .school_nam, value: {pct_isp_21, enroll_m2_, calendar}}] | from_entries' \
  "$SNAPSHOT_DIR/boundaries/es-proposed-24-25.geojson")

jq --argjson lookup "$BOUNDARY_LOOKUP" '{
  type: .type,
  features: [.features[] | {
    type: .type,
    geometry: .geometry,
    properties: (
      .properties as $p |
      ($lookup[$p.school_nam] // {}) as $b |
      {
        name: $p.school_nam,
        address: $p.street_loc,
        dpsid: $p.dpsid,
        lat: $p.latitude,
        lng: $p.longitude,
        region: $p.Region,
        capacity: $p.School_Cap,
        enrollment: ($b.enroll_m2_ // null | if . then (. | tostring | gsub("[^0-9]"; "") | if . == "" then null else tonumber end) else null end),
        isp: ($b.pct_isp_21 // null),
        program: $p.Choice_Pro,
        calendar: ($b.calendar // null)
      }
    )
  }]
}' "$SNAPSHOT_DIR/schools/elementary.geojson" > "$OUTPUT_DIR/schools-es.geojson"

# --- schools-ms.geojson ---
echo "  -> schools-ms.geojson"
jq '{
  type: .type,
  features: [.features[] | {
    type: .type,
    geometry: .geometry,
    properties: .properties | {
      name: .school_name,
      address: .street_location,
      dpsid,
      lat: .latitude,
      lng: .longitude,
      region: .main_regions,
      type: .school_type,
      calendar,
      program: .choice_prg,
      grades
    }
  }]
}' "$SNAPSHOT_DIR/schools/middle.geojson" > "$OUTPUT_DIR/schools-ms.geojson"

# --- schools-hs.geojson ---
echo "  -> schools-hs.geojson"
jq '{
  type: .type,
  features: [.features[] | {
    type: .type,
    geometry: .geometry,
    properties: .properties | {
      name: .school_name,
      address: .street_location,
      dpsid,
      lat: .latitude,
      lng: .longitude,
      region: .main_regions,
      type: .school_type,
      calendar,
      program: .choice_prg,
      grades,
      cte: ([.cte_path1, .cte_path2, .cte_path3] | map(select(. != null and . != "")) | join(", ") | if . == "" then null else . end),
      jrotc: .jrotc_prg
    }
  }]
}' "$SNAPSHOT_DIR/schools/high.geojson" > "$OUTPUT_DIR/schools-hs.geojson"

echo ""
echo "Done. Output files in $OUTPUT_DIR:"
ls -lh "$OUTPUT_DIR"/*.geojson
