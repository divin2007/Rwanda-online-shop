$configs = Get-ChildItem -Path apps -Filter "tsconfig.json" -Depth 2
foreach ($config in $configs) {
    if ($config.FullName -like "*node_modules*") { continue }
    $path = $config.FullName
    Write-Host "Processing: $path"
    $content = Get-Content $path -Raw | ConvertFrom-Json
    
    # Force common fixes
    $content.compilerOptions.moduleResolution = "node"
    $content.compilerOptions.incremental = $false
    $content.compilerOptions.outDir = "./dist"
    
    # Ensure exclude exists
    if ($null -eq $content.exclude) {
        $content | Add-Member -MemberType NoteProperty -Name "exclude" -Value @("node_modules", "test", "dist", "**/*spec.ts")
    }

    $content | ConvertTo-Json -Depth 10 | Set-Content $path
    Write-Host "Fixed: $path"
}
