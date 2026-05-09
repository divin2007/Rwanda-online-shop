$configs = Get-ChildItem -Path apps -Filter "nest-cli.json" -Depth 2
foreach ($config in $configs) {
    if ($config.FullName -like "*node_modules*") { continue }
    $path = $config.FullName
    Write-Host "Fixing: $path"
    $content = Get-Content $path -Raw | ConvertFrom-Json
    
    if ($null -eq $content.compilerOptions) {
        $content | Add-Member -MemberType NoteProperty -Name "compilerOptions" -Value @{ deleteOutDir = $false }
    } else {
        $content.compilerOptions.deleteOutDir = $false
    }

    $content | ConvertTo-Json | Set-Content $path
}
