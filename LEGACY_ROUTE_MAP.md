# Legacy route map

- `/` and `/dar-al-hadith.html` -> `https://e-mawahib-al-manan.vercel.app/ar`
- `/login.html` -> `https://e-mawahib-al-manan.vercel.app/login`
- `/dashboard.html` -> `https://e-mawahib-al-manan.vercel.app/student`
- `/dashboard_prof.html` -> `https://e-mawahib-al-manan.vercel.app/teacher`
- `/parent.html` and carnet URLs -> `https://e-mawahib-al-manan.vercel.app/family`
- admin and controle URLs -> `https://e-mawahib-al-manan.vercel.app/admin`
- unknown legacy URLs -> the closest role route, otherwise `/ar`

The redirect unregisters legacy service workers and removes only caches prefixed `mawahib-`.
