$ErrorActionPreference = "Stop"

$ContainerName = "pm-mvp"

docker rm -f $ContainerName *> $null

Write-Host "Stopped $ContainerName"
