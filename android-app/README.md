# Application Android - مواهب المنان

Cette application Android ouvre la version PWA officielle :

`https://bayaya-devi.github.io/E-Mawahib-Al-Manan-/`

Le site reste la source fonctionnelle unique. Une publication GitHub met donc aussi à jour l'application Android sans reconstruire l'APK, sauf lorsque le code natif, l'icône ou les règles Play Store changent.

## Hors connexion

Après une première connexion avec Internet, le service worker prépare en arrière-plan les 114 sourates et leurs exercices. Les données locales et les opérations en attente sont synchronisées lorsque la connexion revient.

Les fichiers audio sont conservés après leur première lecture. Ils ne sont pas tous téléchargés d'un coup afin de limiter le stockage et la consommation de données mobiles.

## Construction locale

Le projet exige Java 17 ou plus récent et Android SDK 36.

```powershell
.\gradlew.bat assembleDebug
.\gradlew.bat bundleRelease
```

La clé de signature et ses mots de passe ne doivent jamais être ajoutés à Git.
