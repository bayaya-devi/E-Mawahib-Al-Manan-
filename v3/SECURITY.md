# Politique de sécurité

## Protections appliquées

- Supabase Auth gère les mots de passe et les sessions ; aucun mot de passe applicatif n'est stocké en clair.
- Les autorisations reposent sur les rôles serveur et les politiques RLS, pas sur le navigateur.
- Les mutations sensibles vérifient l'origine de la requête, la session, le statut du compte et les droits métier.
- Les fichiers téléversés ont une liste blanche de types, une limite de taille, une signature binaire contrôlée et un nom de stockage aléatoire.
- Les en-têtes de sécurité sont définis dans `next.config.ts` : CSP, HSTS, anti-framing, `nosniff`, referrer policy et permissions policy.
- La connexion est limitée côté serveur par réseau et identifiant haché. Turnstile est disponible en complément lorsqu'il est configuré.

## Signalement responsable

N'envoyez jamais de mot de passe, de clé API ou de données d'élève dans un message public.

Pour signaler une vulnérabilité, contactez l'administration de Dar Al-Qur'an wal-Hadith avec :

1. une description reproductible ;
2. les pages concernées ;
3. l'impact observé ;
4. un moyen de réponse sécurisé.

L'équipe accuse réception, évalue le risque et corrige avant toute divulgation publique lorsque cela est possible.

## Exploitation

- Exécuter `npm run security:secrets`, `npm run security:audit` et `npm run security:test` avant une publication.
- Faire tourner les clés Supabase, notification et Turnstile depuis les tableaux de bord des fournisseurs en cas de soupçon d'exposition.
- Les réglages WAF/DNS/Turnstile à terminer sont décrits dans `docs/CLOUDFLARE.md`.
