<#
Build APK using Docker from PowerShell (Windows).
Run this from the project root (where the android/ folder is):
.\build-apk-pwsh.ps1

This mounts the current working directory into the Docker container so the built
APK will appear in android/app/build/outputs/apk/debug/app-debug.apk.
#>

Write-Host "Starting Docker APK build (PowerShell)..."

try {
    $cwd = (Get-Location).Path
    Write-Host "Mounting: $cwd"
    $image = 'thyrlian/android-sdk'
    $cmd = "cd android && ./gradlew assembleDebug"
    docker run --rm -v "${cwd}:/workspace" -w /workspace $image bash -c "$cmd"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Docker build exited with code $LASTEXITCODE"
        exit $LASTEXITCODE
    }
    Write-Host "Build finished. APK should be at: android/app/build/outputs/apk/debug/app-debug.apk"
} catch {
    Write-Error "Build failed: $_"
    exit 1
}
