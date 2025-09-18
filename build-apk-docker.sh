# Bygg APK med Docker
# Spara denna fil som build-apk-docker.sh och kör: bash build-apk-docker.sh

# Kontrollera att du är i projektets rotmapp (där android/ finns)

# Bygg APK med OpenJDK 17 och Android SDK via Docker
# (Ladda ner färdig image med SDK och Gradle)
docker run --rm -v "C:\\Users\\NatVenture\\Svampkartan":/workspace -w /workspace thyrlian/android-sdk bash -c "cd android && ./gradlew assembleDebug"

echo "\nOm bygget lyckas hittar du APK:n här: android/app/build/outputs/apk/debug/app-debug.apk"
