param(
    [string]$ApiKey = $env:RENDER_API_KEY,
    [string]$MongoUri = $env:MONGODB_URI
)

if (-not $ApiKey) {
    Write-Host "ERROR: Render API key is required. Set RENDER_API_KEY environment variable or pass -ApiKey parameter." -ForegroundColor Red
    exit 1
}

if (-not $MongoUri) {
    Write-Host "ERROR: MongoDB URI is required. Set MONGODB_URI environment variable or pass -MongoUri parameter." -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $ApiKey"
    "Content-Type"  = "application/json"
    "Accept"        = "application/json"
}

# Step 1: Get all services
Write-Host "Fetching all services..." -ForegroundColor Cyan
$resp = Invoke-RestMethod -Uri "https://api.render.com/v1/services?limit=50" -Headers $headers -Method GET
$services = $resp | Where-Object { $_.service.name -like "rmf-*" }
Write-Host "Found $($services.Count) rmf-* services:" -ForegroundColor Green
$services | ForEach-Object { Write-Host "  - $($_.service.name) [$($_.service.id)]" }

# Step 2: Get environment groups to find rwshop-secrets ID
Write-Host "`nFetching environment groups..." -ForegroundColor Cyan
$groups = Invoke-RestMethod -Uri "https://api.render.com/v1/env-groups?limit=50" -Headers $headers -Method GET
$rwshop = $groups | Where-Object { $_.name -eq "rwshop-secrets" }
Write-Host "rwshop-secrets group ID: $($rwshop.id)" -ForegroundColor Green

# Step 3: For each service, update MONGODB_URI
foreach ($svc in $services) {
    $svcId = $svc.service.id
    $svcName = $svc.service.name
    Write-Host "`nProcessing: $svcName ($svcId)" -ForegroundColor Yellow

    try {
        $envVars = Invoke-RestMethod -Uri "https://api.render.com/v1/services/$svcId/env-vars" -Headers $headers -Method GET

        $updatedVars = $envVars | ForEach-Object {
            if ($_.key -eq "MONGODB_URI") {
                @{ key = "MONGODB_URI"; value = $MongoUri }
            } else {
                @{ key = $_.key; value = $_.value }
            }
        }

        $body = @{ envVars = $updatedVars } | ConvertTo-Json -Depth 5
        $result = Invoke-RestMethod -Uri "https://api.render.com/v1/services/$svcId/env-vars" -Headers $headers -Method PUT -Body $body
        Write-Host "  Updated env vars OK" -ForegroundColor Green
    } catch {
        Write-Host "  ERROR: $_" -ForegroundColor Red
    }
}

Write-Host "`nDone! Triggering redeployment of all services..." -ForegroundColor Cyan
foreach ($svc in $services) {
    $svcId = $svc.service.id
    $svcName = $svc.service.name
    try {
        $result = Invoke-RestMethod -Uri "https://api.render.com/v1/services/$svcId/deploys" -Headers $headers -Method POST -Body '{"clearCache":"do_not_clear"}'
        Write-Host "  Triggered deploy for $svcName" -ForegroundColor Green
    } catch {
        Write-Host "  ERROR deploying $svcName : $_" -ForegroundColor Red
    }
}
Write-Host "`nAll done!" -ForegroundColor Green
