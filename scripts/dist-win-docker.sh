#!/usr/bin/env bash
# Roda DENTRO do container electronuserland/builder:wine.
set -euo pipefail

cd /project

echo "==> Foto Geo · empacotamento Windows (Docker/Wine)"
echo "    Node: $(node -v)  npm: $(npm -v)"

# Yarn classic (mesmo do projeto)
if ! command -v yarn >/dev/null 2>&1; then
  npm install -g yarn@1.22.22
fi
echo "    Yarn: $(yarn -v)"

# Desliga platform/arch forçados do compose durante yarn/build —
# senão o yarn puxa opcionais win32 e o electron-vite (rollup) quebra no Linux.
unset npm_config_platform npm_config_arch npm_config_target_platform npm_config_target_arch || true

echo "==> yarn install (deps do host Linux para o build)"
yarn install --frozen-lockfile --ignore-engines || yarn install --ignore-engines

echo "==> electron-vite build"
yarn build

echo "==> Forçando nativos win32-x64 (depois do build — yarn/npm pulam outro OS)"
# --os/--cpu faz o npm baixar @img/sharp-win32-* em container Linux.
# Feito APÓS o build para não remover @rollup/rollup-linux-* .
npm install --no-save --os=win32 --cpu=x64 \
  @img/sharp-win32-x64@0.35.3 \
  @img/sharp-libvips-win32-x64@1.3.2 \
  @resvg/resvg-js-win32-x64-msvc@2.6.2 \
  exiftool-vendored.exe@13.59.0

for d in \
  node_modules/@img/sharp-win32-x64 \
  node_modules/@img/sharp-libvips-win32-x64 \
  node_modules/@resvg/resvg-js-win32-x64-msvc \
  node_modules/exiftool-vendored.exe
do
  if [[ ! -d "$d" ]]; then
    echo "ERRO: $d não foi instalado" >&2
    exit 1
  fi
done
echo "    OK: sharp-win32 + resvg-win32 + exiftool.exe"

echo "==> electron-builder --win portable zip"
npx electron-builder --win portable zip --x64 --publish never

echo ""
echo "==> Checagem rápida do pacote:"
UNPACKED_NM=dist/win-unpacked/resources/app.asar.unpacked/node_modules
if [[ -d "$UNPACKED_NM/@img/sharp-win32-x64" ]]; then
  echo "    OK: sharp-win32-x64 presente em win-unpacked"
else
  echo "    ERRO: sharp-win32-x64 não encontrado em win-unpacked" >&2
  exit 1
fi
if [[ -d "$UNPACKED_NM/exiftool-vendored.exe" ]]; then
  echo "    OK: exiftool-vendored.exe presente em win-unpacked"
else
  echo "    ERRO: exiftool-vendored.exe não encontrado em win-unpacked" >&2
  exit 1
fi
if [[ -f dist/win-unpacked/resources/fonts/roboto.ttf ]]; then
  echo "    OK: resources/fonts/roboto.ttf"
else
  echo "    ERRO: resources/fonts/roboto.ttf ausente" >&2
  exit 1
fi
if [[ -d "$UNPACKED_NM/@resvg/resvg-js-win32-x64-msvc" ]] || [[ -d "$UNPACKED_NM/@resvg/resvg-js" ]]; then
  echo "    OK: @resvg presente em win-unpacked"
else
  echo "    ERRO: @resvg ausente em win-unpacked" >&2
  find dist/win-unpacked/resources -path '*resvg*' 2>/dev/null | head -20 >&2 || true
  exit 1
fi
# Confirma que nativos linux não foram embutidos
if ls "$UNPACKED_NM/@img" 2>/dev/null | grep -q 'linux'; then
  echo "    ERRO: pacotes @img linux ainda presentes no .exe" >&2
  ls "$UNPACKED_NM/@img" >&2
  exit 1
fi

echo ""
echo "==> Pronto. Artefatos em ./dist/"
ls -lah dist/ 2>/dev/null || true
