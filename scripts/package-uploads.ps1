param(
  [string]$SourcePath = ".\server\uploads",
  [string]$OutputFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $SourcePath)) {
  throw "Uploads klasoru bulunamadi: $SourcePath"
}

if (-not $OutputFile) {
  $dateText = Get-Date -Format "yyyy-MM-dd_HH-mm"
  $OutputFile = "..\dijital-ziyaretci-uploads-$dateText.zip"
}

if (Test-Path -LiteralPath $OutputFile) {
  Remove-Item -LiteralPath $OutputFile -Force
}

Compress-Archive -Path (Join-Path $SourcePath "*") -DestinationPath $OutputFile -Force
Write-Host "Uploads paketi hazir: $OutputFile"
