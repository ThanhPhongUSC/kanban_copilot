$ErrorActionPreference = "Stop"

$RootDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$ImageName = "pm-mvp:local"
$ContainerName = "pm-mvp"

Set-Location $RootDir

docker build -t $ImageName .

docker rm -f $ContainerName *> $null

docker run -d `
  --name $ContainerName `
  --env-file "$RootDir/.env" `
  -p 8000:8000 `
  $ImageName

Write-Host "Started $ContainerName on http://localhost:8000"
