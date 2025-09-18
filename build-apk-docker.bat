@echo off
REM Bygg APK med Docker i Windows CMD/PowerShell
REM Spara denna fil som build-apk-docker.bat och dubbelklicka eller kör i PowerShell/cmd

REM Kontrollera att Docker Desktop är igång!

docker run --rm -v C:\Users\NatVenture\Svampkartan:/workspace -w /workspace thyrlian/android-sdk bash -c "cd android && ./gradlew assembleDebug"

if %errorlevel% neq 0 (
  echo Bygget misslyckades!
) else (
  echo Bygget lyckades! APK finns i android\app\build\outputs\apk\debug\app-debug.apk
)
pause
