# Refonte UI/UX adaptative

## Principes

La présentation repose sur un seul frontend et conserve les routes, permissions, appels API et règles métier existants. La couche visuelle ajoute une hiérarchie plus calme, des cibles tactiles confortables et un verre translucide limité aux éléments de navigation et de contexte.

## Design system

- Couleurs institutionnelles : champagne `#B88646`, café `#241C18`, argent `#C8C8C5`, blanc cassé `#F7F7F5`, sombre `#171719`.
- Surfaces : fonds opaques pour la lecture, verre uniquement pour les barres, menus, modales et notifications.
- Typographie : familles arabes locales existantes, tailles fluides sans dépendre directement de la largeur de l'écran.
- Espacements : grille de 4 px, contrôles principaux d'au moins 44 px.
- Rayons : modérés pour les contrôles, plus généreux seulement pour les panneaux flottants.
- Mouvement : 150 à 250 ms, désactivé ou simplifié avec `prefers-reduced-motion`.
- Transparence : repli opaque avec `prefers-reduced-transparency` ou sans prise en charge de `backdrop-filter`.

## Navigation

- Téléphone : quatre destinations prioritaires par rôle et un bouton `المزيد` ouvrant toutes les destinations secondaires. Aucune route n'est supprimée.
- Tablette : rail droit compact avec icônes et infobulles natives.
- Bureau : barre latérale droite rétractable, contenu réalloué quand elle est réduite.
- RTL/LTR : les composants héritent de la direction de leur page ; les modales ne forcent plus le RTL.

## Adaptation élève

La date de naissance existante détermine uniquement une variante visuelle :

- `child`, 5 à 8 ans : contrôles et texte plus grands, espacement accru.
- `teen`, 9 à 18 ans : densité équilibrée et présentation contemporaine.
- `adult`, plus de 18 ans : palette et mouvement plus sobres.
- `neutral` : utilisée si la date est absente, invalide ou hors plage.

Aucune autorisation, progression ou règle pédagogique ne dépend de cette variante.

## Accessibilité

- Focus visible et contrastes conservés en clair et sombre.
- Boutons iconiques nommés et destinations secondaires accessibles au clavier.
- Modales Radix avec gestion du focus.
- Cibles tactiles principales de 44 px minimum.
- États forcés Windows et réduction des animations pris en charge.

## Portée

La refonte ne modifie ni Supabase, ni RLS, ni API, ni authentification, ni données. Les traductions françaises internes n'existent pas encore dans le produit actuel ; la couche visuelle est compatible LTR, mais aucun faux contenu traduit n'a été inventé.
