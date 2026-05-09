$apps = Get-ChildItem -Path apps -Directory
foreach ($app in $apps) {
    $pkgPath = Join-Path $app.FullName "package.json"
    if (Test-Path $pkgPath) {
        $content = Get-Content $pkgPath -Raw | ConvertFrom-Json
        if (-not $content.scripts.dev) {
            # Add dev script
            $content.scripts | Add-Member -MemberType NoteProperty -Name "dev" -Value "npm run start:dev" -Force
            # Save back
            $content | ConvertTo-Json -Depth 10 | Set-Content $pkgPath
            Write-Host "Fixed: $($app.Name)" -ForegroundColor Green
        } else {
            Write-Host "Already has dev: $($app.Name)" -ForegroundColor Yellow
        }
    }
}
