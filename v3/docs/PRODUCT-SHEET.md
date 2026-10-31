# Fiche produit

## Produit

E-Mawahib Al-Manan est une plateforme éducative de Dar Al-Qur'an wal-Hadith. Elle réunit un site public multilingue et des espaces privés pour élèves, familles, professeurs et administration.

## Utilisateurs et données

- Visiteurs : informations publiques, programmes, horaires, actualités et replays.
- Élèves : parcours de mémorisation, exercices, suivi pédagogique, devoirs et messages.
- Familles : sélection d'enfant, suivi, présence, devoirs et communication.
- Professeurs : séances, enregistrement des récitations, devoirs, rapports et demandes.
- Administration/direction : comptes, classes, finance, contenus publics, supervision et audit.

La plateforme traite des identités, coordonnées de tuteurs, données scolaires, présences, paiements, messages, fichiers autorisés et résultats pédagogiques. Les données applicatives sont hébergées dans Supabase et protégées par les règles RLS ; l'interface Next.js est déployée sur Vercel.

## Stack et frontières

- Next.js 16, React 19 et TypeScript strict.
- Supabase Auth, PostgreSQL, Storage et Realtime.
- Zod pour les entrées serveur.
- Vitest pour l'unitaire et l'intégration ; Playwright pour les parcours navigateur.
- Vercel pour les déploiements. Cloudflare est préparé comme périmètre DNS/WAF/Turnstile, sans remplacer Supabase ni Vercel.

## Langues et accessibilité

Le produit publie en arabe RTL, français, anglais et amazigh en tifinagh. Les espaces privés sont prioritairement utilisés sur mobile.

## Modules retenus

Les onze modules du document A&B Technologies sont retenus : la plateforme a une API, une base de données, des comptes mineurs/familles, un site public multilingue, une audience mobile et des coûts d'exploitation à maîtriser. L'exécution suit : 08 qualité, 03 sécurité, 02 backend, 04 fiabilité, 09 conformité, 01 performance, 05 SEO, 06 compatibilité, 07 accessibilité, 10 UX technique, 11 exploitation.

## Hypothèses à vérifier par un humain

- Le responsable légal, l'adresse de l'association et les mentions réglementaires définitives restent à confirmer avant le module conformité.
- Un domaine personnalisé et un compte Cloudflare restent nécessaires pour activer DNS/WAF/CDN en production.
