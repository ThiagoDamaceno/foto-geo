# Windows 10/11 nativo: gera portable + zip em .\dist\
# Uso:  .\scripts\dist-win.ps1
#   ou: yarn dist:win:native

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "==> Foto Geo · empacotamento Windows (nativo)"
Write-Host "    Node: $(node -v)  Yarn: $(yarn -v)"

if (-not (Get-Command yarn -ErrorAction SilentlyContinue)) {
  Write-Error "Yarn não encontrado. Instale Yarn 1.22.x e rode de novo."
}

Write-Host "==> yarn install"
yarn install

Write-Host "==> Garantindo nativos win32 (sharp + exiftool)"
node scripts/ensure-win-natives.mjs

Write-Host "==> electron-vite build"
yarn build

Write-Host "==> electron-builder --win portable zip"
npx electron-builder --win portable zip --x64 --publish never

Write-Host ""
Write-Host "==> Pronto. Artefatos em .\dist\"
Get-ChildItem dist | Format-Table Name, Length, LastWriteTime
Write-Host "Perfis do usuário ficam em profiles\ ao lado do executável."
