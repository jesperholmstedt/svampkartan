# Bygg APK med Docker
# Spara denna fil som build-apk-docker.sh och kör: bash build-apk-docker.sh

# Kontrollera att du är i projektets rotmapp (där android/ finns)

# Bygg APK med OpenJDK 17 och Android SDK via Docker
# (Ladda ner färdig image med SDK och Gradle)
# Use the current working directory as the mount point so the APK ends up in this repo folder.
# When running from Git Bash or WSL this will produce a proper path. If you run from PowerShell,
# start the script using a Bash shell (Git Bash or WSL) so $(pwd) expands correctly.
docker run --rm -v "$(pwd):/workspace" -w /workspace thyrlian/android-sdk bash -c "cd android && ./gradlew assembleDebug"

echo "\nOm bygget lyckas hittar du APK:n här: android/app/build/outputs/apk/debug/app-debug.apk"
