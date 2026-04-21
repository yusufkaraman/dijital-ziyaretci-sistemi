param(
  [string]$OutputFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $OutputFile) {
  $dateText = Get-Date -Format "yyyy-MM-dd_HH-mm"
  $OutputFile = "..\dijital-ziyaretci-kod-$dateText.zip"
}

$excludeExact = @(
  ".git",
  ".claude",
  "node_modules",
  "docs",
  "tests",
  "server\uploads",
  "prisma\generated-client",
  ".env",
  ".env.production",
  "server-start.out.log",
  "server-start.err.log"
)

$items = Get-ChildItem -Force | Where-Object {
  $relative = $_.FullName.Substring($PWD.Path.Length + 1)
  -not ($excludeExact | Where-Object { $relative -eq $_ -or $relative.StartsWith($_ + "\") })
}

if (Test-Path -LiteralPath $OutputFile) {
  Remove-Item -LiteralPath $OutputFile -Force
}

Compress-Archive -Path $items.FullName -DestinationPath $OutputFile -Force
Write-Host "Kod paketi hazir: $OutputFile"
