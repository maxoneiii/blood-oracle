# Builds the module and packs exactly what a Foundry install needs.
# Windows counterpart of release.sh — run it from PowerShell.
#
# The rules reference is deliberately absent: it is book text, it lives in
# Foundry's Data directory, and every client fetches it from the server.

$ErrorActionPreference = 'Stop'

Set-Location (Join-Path $PSScriptRoot '..')

$version = (Get-Content module.json -Raw | ConvertFrom-Json).version
$out = 'build'

npm run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }

if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Path "$out\blood-oracle" | Out-Null

Copy-Item module.json, README.md, RULES.md, LICENSE "$out\blood-oracle\"
Copy-Item dist, icons, fonts "$out\blood-oracle\" -Recurse

Compress-Archive -Path "$out\blood-oracle" -DestinationPath "$out\module.zip"
Copy-Item "$out\blood-oracle\module.json" "$out\module.json"

Write-Host ''
Write-Host "Packed version $version"
Write-Host "  $out\module.zip   - attach to the release"
Write-Host "  $out\module.json  - attach to the release"
