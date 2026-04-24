#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/install-safe-solana-builder.sh [--codex] [--claude] [--both] [--source PATH] [--name NAME]

Installs the local safe-solana-builder skill bundle into Codex and/or Claude skill directories.

Defaults:
  --codex   Install to ~/.codex/skills
  --source  ./context/safe-solana-builder-main
  --name    safe-solana-builder

Examples:
  scripts/install-safe-solana-builder.sh
  scripts/install-safe-solana-builder.sh --claude
  scripts/install-safe-solana-builder.sh --both
EOF
}

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_dir="${root_dir}/context/safe-solana-builder-main"
skill_name="safe-solana-builder"
install_codex=false
install_claude=false

if [[ $# -eq 0 ]]; then
  install_codex=true
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --codex)
      install_codex=true
      ;;
    --claude)
      install_claude=true
      ;;
    --both|--all)
      install_codex=true
      install_claude=true
      ;;
    --source)
      shift
      [[ $# -gt 0 ]] || { echo "Missing value for --source" >&2; exit 1; }
      source_dir="$1"
      ;;
    --name)
      shift
      [[ $# -gt 0 ]] || { echo "Missing value for --name" >&2; exit 1; }
      skill_name="$1"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

if [[ ! -d "$source_dir" ]]; then
  echo "Source directory not found: $source_dir" >&2
  exit 1
fi

if [[ "$install_codex" != true && "$install_claude" != true ]]; then
  install_codex=true
fi

install_into() {
  local target_root="$1"
  local destination="${target_root}/${skill_name}"

  mkdir -p "$target_root"
  rsync -a --delete "${source_dir}/" "${destination}/"
  echo "Installed ${skill_name} -> ${destination}"
}

if [[ "$install_codex" == true ]]; then
  install_into "${HOME}/.codex/skills"
fi

if [[ "$install_claude" == true ]]; then
  install_into "${HOME}/.claude/skills"
fi
