param(
  [string]$EnvFile = ".env",
  [string]$OutputFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Read-EnvFile {
  param([string]$Path)

  $values = @{}
  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed) { continue }
    if ($trimmed.StartsWith("#")) { continue }
    $parts = $trimmed -split "=", 2
    if ($parts.Count -ne 2) { continue }
    $key = $parts[0].Trim()
    $value = $parts[1].Trim().Trim('"')
    $values[$key] = $value
  }
  return $values
}

if (-not (Test-Path -LiteralPath $EnvFile)) {
  throw ".env dosyasi bulunamadi: $EnvFile"
}

$envValues = Read-EnvFile -Path $EnvFile
$dbName = $envValues["POSTGRES_DB"]
$dbUser = $envValues["POSTGRES_USER"]
$dbPassword = $envValues["POSTGRES_PASSWORD"]

if (-not $dbName -or -not $dbUser -or -not $dbPassword) {
  throw ".env icinde POSTGRES_DB, POSTGRES_USER ve POSTGRES_PASSWORD zorunlu."
}

if (-not $OutputFile) {
  $dateText = Get-Date -Format "yyyy-MM-dd_HH-mm"
  $OutputFile = ".\backup-$dbName-$dateText.sql"
}

$dockerContainer = "dijital-ziyaretci-postgres"
$dockerExists = $null
try {
  $dockerExists = docker ps --format "{{.Names}}" 2>$null | Where-Object { $_ -eq $dockerContainer }
} catch {
  $dockerExists = $null
}

if ($dockerExists) {
  Write-Host "Docker icindeki PostgreSQL bulundu. SQL dump aliniyor..."
  $dumpText = docker exec -e PGPASSWORD=$dbPassword -t $dockerContainer pg_dump -U $dbUser -d $dbName --clean --if-exists --create
  Set-Content -LiteralPath $OutputFile -Value $dumpText
  Write-Host "Tamamlandi: $OutputFile"
  exit 0
}

$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if ($pgDump) {
  Write-Host "Yerel pg_dump bulundu. SQL dump aliniyor..."
  $env:PGPASSWORD = $dbPassword
  & $pgDump.Source -h localhost -p 5432 -U $dbUser -d $dbName --clean --if-exists --create -f $OutputFile
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
  Write-Host "Tamamlandi: $OutputFile"
  exit 0
}

throw "Ne Docker container bulundu ne de pg_dump PATH icinde bulundu. PostgreSQL kuruluysa pg_dump yolunu PATH'e ekleyin veya Docker ile calistirin."
