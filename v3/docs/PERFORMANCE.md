# Performance

## Objectifs

- LCP mobile inférieur à 2,5 s sur les pages publiques chaudes.
- CLS inférieur à 0,1.
- INP terrain inférieur à 200 ms.
- Aucun média public supérieur à 150 Ko sans justification.
- Régression de poids bloquée par `npm run perf:check`.

## Mesures

Les rapports Lighthouse JSON sont conservés dans `reports/perf/avant` et `reports/perf/apres`. Les mesures locales simulées sont sensibles à la charge de la machine; la validation finale doit être répétée sur l'URL de production après échauffement du cache.

| Page | Avant score | Avant LCP | Après score local valide | Après LCP local valide |
| --- | ---: | ---: | ---: | ---: |
| Accueil | 76 | 4,47 s | à remesurer en production | à remesurer en production |
| Contact | 70 | 4,53 s | 80 | 3,66 s |
| Connexion | 83 | 3,63 s | à remesurer en production | à remesurer en production |

## Optimisations livrées

- shell public rendu côté serveur et contrôles interactifs isolés;
- suppression des imports-barrels qui embarquaient les espaces authentifiés et Supabase sur le site public;
- préchargement du bundle de connexion désactivé depuis le site public;
- images AVIF/WebP générées et image de classe WebP utilisée;
- formats Next Image AVIF/WebP et cache d'images prolongé;
- polices locales Fontsource, sans dépendance Google Fonts;
- rapports Lighthouse versionnés et budget local reproductible;
- budget automatisé sur JavaScript, CSS et médias;
- exemple Nginx avec compression et cache immuable des assets versionnés.

## Commandes

```bash
npm run build
npm run perf:check
```

Pour Lighthouse, lancer le serveur de production puis auditer chaque route séparément. Deux échecs `NO_NAVSTART` consécutifs doivent être consignés comme mesure invalide, jamais convertis en réussite.
