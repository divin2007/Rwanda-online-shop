# Local Development Setup and Startup Script for Rwanda Online Shop
# This script ensures Docker is running, starts the local DB/Cache, and launches the platform.

Write-Host "--- Rwanda Online Shop: Localhost Replica Setup ---" -ForegroundColor Cyan

# 1. Load Environment Variables from root .env
if (Test-Path ".env") {
    Write-Host "Loading environment variables from .env..." -ForegroundColor Gray
    Get-Content .env | Where-Object { $_ -match '=' -and $_ -notmatch '^#' } | ForEach-Object {
        $line = $_.Trim()
        if ($line) {
            $name, $value = $line.Split('=', 2)
            $name = $name.Trim()
            $value = $value.Trim()
            # Remove quotes if present
            if ($value.StartsWith('"') -and $value.EndsWith('"')) { $value = $value.Substring(1, $value.Length - 2) }
            if ($value.StartsWith("'") -and $value.EndsWith("'")) { $value = $value.Substring(1, $value.Length - 2) }
            if ($name -ne "PORT") {
                [System.Environment]::SetEnvironmentVariable($name, $value, [System.EnvironmentVariableTarget]::Process)
            }
        }
    }
}

# 1.1 Load and merge Environment Variables from root .env.local (takes precedence)
if (Test-Path ".env.local") {
    Write-Host "Loading environment variables from .env.local..." -ForegroundColor Gray
    Get-Content .env.local | Where-Object { $_ -match '=' -and $_ -notmatch '^#' } | ForEach-Object {
        $line = $_.Trim()
        if ($line) {
            $name, $value = $line.Split('=', 2)
            $name = $name.Trim()
            $value = $value.Trim()
            # Remove quotes if present
            if ($value.StartsWith('"') -and $value.EndsWith('"')) { $value = $value.Substring(1, $value.Length - 2) }
            if ($value.StartsWith("'") -and $value.EndsWith("'")) { $value = $value.Substring(1, $value.Length - 2) }
            if ($name -ne "PORT") {
                [System.Environment]::SetEnvironmentVariable($name, $value, [System.EnvironmentVariableTarget]::Process)
            }
        }
    }
}


# 2. Check for Docker
if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Docker is not installed or not in PATH. Please install Docker Desktop to run local MongoDB/Redis."
    exit 1
}

# 2. Start Infrastructure
Write-Host "Starting local infrastructure (MongoDB, Redis, MailDev, etc.) via Docker..." -ForegroundColor Yellow
docker-compose up -d

Write-Host "Infrastructure is ready:" -ForegroundColor Cyan
Write-Host " - MongoDB: localhost:27017"
Write-Host " - Redis:   localhost:6379"
Write-Host " - MailDev (Emails): http://localhost:1080"
Write-Host " - Mongo Express (DB Admin): http://localhost:8081 (admin/pass)"
Write-Host ""

# 3. Install Dependencies (if node_modules doesn't exist)
if (!(Test-Path "node_modules")) {
    Write-Host "Installing dependencies... This may take a few minutes." -ForegroundColor Yellow
    npm install
}

# 4. Start the Platform
Write-Host "Starting all services via Turbo... (Frontend will be on http://localhost:3000)" -ForegroundColor Green
Write-Host "Note: For subdomains, use http://[market-slug].localhost:3000" -ForegroundColor Cyan
npm run dev
