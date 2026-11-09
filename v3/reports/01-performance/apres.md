# Après

- Imports publics ciblés: les espaces admin, professeur, famille et le client Supabase ne font plus partie du parcours public.
- Le transfert mesuré sur Contact passe de 559 Ko à 456 Ko.
- Contact: score 80, LCP 3 663 ms, CLS 0,020, TBT 276 ms en simulation locale froide.
- Les mesures Accueil et Connexion seront remplacées par les mesures de production; les tentatives locales ont rencontré `NO_NAVSTART` ou une forte contention machine.
- Le budget statique et les images optimisées sont vérifiés automatiquement.

Le seuil LCP de 2,5 s reste un objectif terrain à surveiller dans les Core Web Vitals; aucune valeur non mesurée n'est déclarée conforme.
