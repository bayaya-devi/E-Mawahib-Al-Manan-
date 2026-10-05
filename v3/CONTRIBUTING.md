# Contribution

1. Créer une branche dédiée et ne pas modifier directement les données de production.
2. Respecter les frontières `app`, `features`, `components` et `lib` décrites dans `docs/QUALITY.md`.
3. Ajouter ou mettre à jour un test pour toute correction métier, autorisation ou calcul.
4. Lancer `npm run check` avant une publication.
5. Ne jamais committer de secret, de clé Supabase service role, de mot de passe ou de fichier `.env.local`.
6. Utiliser des commits courts et explicites : `fix(auth): ...`, `feat(student): ...`, `docs(quality): ...`.

Les migrations Supabase sont additives par défaut. Toute suppression ou migration de données doit être revue séparément et testée hors production.
