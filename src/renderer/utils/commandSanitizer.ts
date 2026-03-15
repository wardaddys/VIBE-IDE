/**
 * Translate Unix/bash commands to PowerShell equivalents.
 * Runs on every <execute> command before it hits the terminal.
 * If the command is already PowerShell-native it passes through unchanged.
 */
export function sanitizeForPowerShell(command: string): string {
    let cmd = command.trim()

    // Replace && with ; (PowerShell uses semicolons)
    cmd = cmd.replace(/\s*&&\s*/g, '; ')

    // Replace || with PowerShell equivalent
    cmd = cmd.replace(/\s*\|\|\s*/g, '; if ($LASTEXITCODE -ne 0) { ')

    // ls variants → dir
    cmd = cmd.replace(/^ls\s*-la?\b/gm, 'dir')
    cmd = cmd.replace(/^ls\s*-al?\b/gm, 'dir')
    cmd = cmd.replace(/^ls\s*$/gm, 'dir')
    cmd = cmd.replace(/^ls\s+([^\|]+)/gm, 'dir "$1"')

    // cat → Get-Content
    cmd = cmd.replace(/\bcat\s+([^\|;\n]+)/g, 'Get-Content "$1"')

    // touch → New-Item
    cmd = cmd.replace(
        /\btouch\s+([^\|;\n]+)/g,
        'New-Item -ItemType File -Force "$1"'
    )

    // mkdir -p → New-Item
    cmd = cmd.replace(
        /\bmkdir\s+-p\s+([^\|;\n]+)/g,
        'New-Item -ItemType Directory -Force "$1"'
    )
    cmd = cmd.replace(
        /\bmkdir\s+([^\|;\n]+)/g,
        'New-Item -ItemType Directory -Force "$1"'
    )

    // rm -rf → Remove-Item
    cmd = cmd.replace(
        /\brm\s+-rf?\s+([^\|;\n]+)/g,
        'Remove-Item -Recurse -Force "$1"'
    )
    cmd = cmd.replace(
        /\brm\s+([^\|;\n]+)/g,
        'Remove-Item "$1"'
    )

    // cp → Copy-Item
    cmd = cmd.replace(
        /\bcp\s+([^\s]+)\s+([^\|;\n]+)/g,
        'Copy-Item "$1" "$2"'
    )

    // mv → Move-Item
    cmd = cmd.replace(
        /\bmv\s+([^\s]+)\s+([^\|;\n]+)/g,
        'Move-Item "$1" "$2"'
    )

    // grep → Select-String
    cmd = cmd.replace(
        /\bgrep\s+([^\s]+)\s+([^\|;\n]+)/g,
        'Select-String "$1" "$2"'
    )

    // find . -name → Get-ChildItem -Recurse -Filter
    cmd = cmd.replace(
        /\bfind\s+\.\s+-name\s+([^\|;\n]+)/g,
        'Get-ChildItem -Recurse -Filter $1'
    )

    // echo with quotes
    cmd = cmd.replace(/\becho\s+"([^"]+)"/g, 'Write-Host "$1"')
    cmd = cmd.replace(/\becho\s+'([^']+)'/g, "Write-Host '$1'")
    cmd = cmd.replace(/\becho\s+([^\|;\n]+)/g, 'Write-Host $1')

    // pwd → Get-Location
    cmd = cmd.replace(/\bpwd\b/g, 'Get-Location')

    // which → Get-Command
    cmd = cmd.replace(/\bwhich\s+([^\|;\n]+)/g, 'Get-Command $1')

    // chmod / chown → no-op with note (Windows doesn't use these)
    cmd = cmd.replace(
        /\bchmod\s+[^\|;\n]+/g,
        'Write-Host "chmod not needed on Windows"'
    )
    cmd = cmd.replace(
        /\bchown\s+[^\|;\n]+/g,
        'Write-Host "chown not needed on Windows"'
    )

    // head -n → Select-Object -First
    cmd = cmd.replace(
        /\bhead\s+-(\d+)\s+([^\|;\n]+)/g,
        'Get-Content "$2" | Select-Object -First $1'
    )
    cmd = cmd.replace(
        /\bhead\s+-n\s+(\d+)\s+([^\|;\n]+)/g,
        'Get-Content "$2" | Select-Object -First $1'
    )

    // tail -n → Select-Object -Last
    cmd = cmd.replace(
        /\btail\s+-(\d+)\s+([^\|;\n]+)/g,
        'Get-Content "$2" | Select-Object -Last $1'
    )

    // wc -l → Measure-Object
    cmd = cmd.replace(
        /\bwc\s+-l\s*([^\|;\n]*)/g,
        (_, file: string) => file.trim()
            ? `(Get-Content "${file.trim()}").Count`
            : '($input | Measure-Object -Line).Lines'
    )

    // sed basic replace → not easy, just warn
    cmd = cmd.replace(
        /\bsed\s+[^\|;\n]+/g,
        'Write-Host "Use (Get-Content file) -replace pattern, replacement | Set-Content file"'
    )

    return cmd
}
