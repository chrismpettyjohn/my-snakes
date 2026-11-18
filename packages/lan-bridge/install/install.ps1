param([Parameter(Mandatory = $true)][string]$ApiUrl, [Parameter(Mandatory = $true)][string]$Token)

$ApiUrl = $ApiUrl.TrimEnd('/')
$Name = 'snake-bridge'

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Error 'Docker Desktop is required: https://docs.docker.com/desktop/setup/install/windows-install/'; return
}
docker info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Error "Docker isn't running. Start Docker Desktop and run this again."; return }

$subnets = $env:SCAN_SUBNETS
if (-not $subnets) {
  $subnets = (Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } |
    ForEach-Object { $_.IPv4Address } | ForEach-Object { "$($_.IPAddress)/$($_.PrefixLength)" }) -join ','
}

$alias = if ($ApiUrl -match '^http://(localhost|127\.0\.0\.1)([:/]|$)') { 'host.docker.internal' } else { '' }
$local = if ($PSScriptRoot -and (Test-Path (Join-Path $PSScriptRoot '..\src\agent.ts'))) { (Resolve-Path (Join-Path $PSScriptRoot '..')).Path } else { '' }

Write-Host "Building $Name image..."
if ($local) {
  "FROM oven/bun:1-alpine`nCOPY src/agent.ts /app/agent.ts`nCMD [`"bun`", `"/app/agent.ts`"]`n" | docker build --pull -q -t $Name -f - $local | Out-Null
} else {
  "FROM oven/bun:1-alpine`nADD --chmod=644 $ApiUrl/bridge/agent.ts /app/agent.ts`nCMD [`"bun`", `"/app/agent.ts`"]`n" | docker build --pull --no-cache -q -t $Name - | Out-Null
}
if ($LASTEXITCODE -ne 0) { Write-Error 'docker build failed'; return }

docker rm -f $Name 2>&1 | Out-Null
docker run -d --name $Name --restart unless-stopped `
  -e "API_URL=$ApiUrl" `
  -e "BRIDGE_TOKEN=$Token" `
  -e "SCAN_SUBNETS=$subnets" `
  -e "HERPSTAT_HOSTS=$env:HERPSTAT_HOSTS" `
  -e "BRIDGE_HOSTNAME=$env:COMPUTERNAME" `
  -e "LOCALHOST_ALIAS=$alias" `
  $Name | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Error 'docker run failed'; return }

Write-Host "Snake bridge is running and scanning $subnets."
Write-Host "  Logs:      docker logs -f $Name"
Write-Host "  Uninstall: docker rm -f $Name"
Write-Host 'It restarts with Docker. Turn on Docker Desktop > Settings > General > Start Docker Desktop when you sign in.'
