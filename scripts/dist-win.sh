#!/usr/bin/env bash
# Linux / WSL / macOS: gera o .exe Windows via Docker Compose.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker não encontrado. Instale o Docker (no WSL: Docker Desktop com integração WSL)." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose não disponível. Atualize o Docker / instale o plugin compose." >&2
  exit 1
fi

mkdir -p dist

echo "==> Subindo win-builder (electronuserland/builder:24-wine)…"
echo "    Saída: $ROOT/dist"
echo ""

# volume antigo (Node 20) pode conflitar — recria só o node_modules do builder se precisar
docker compose run --rm --remove-orphans win-builder

echo ""
echo "==> Conteúdo de dist/:"
ls -lah dist/ || true
echo ""
echo "Leve para o Windows: o *-portable.exe e/ou o *-win-x64.zip"
echo "Perfis do usuário: %APPDATA%\\foto-geo\\profiles"
