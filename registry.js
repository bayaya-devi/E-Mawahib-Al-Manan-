/**
 * =========================================================
 *  REGISTRE CENTRAL — منصة دار القرآن
 * =========================================================
 *  Pour ajouter une nouvelle sourate :
 *  1. Crée son fichier HTML  (ex: Al_Kawthar.html)
 *  2. Ajoute une entrée ici avec  available: true
 *  C'est tout — l'index se met à jour automatiquement.
 * =========================================================
 */

const SURAH_REGISTRY = [
  {
    id: "al-alaq",
    num: 96,
    nameAr: "سورة العلق",
    ayat: 19,
    parts: 4,          // nombre de sections dans la page (quarters/halves)
    type: "مكية",
    color: "#059669",  // couleur dominante de la page (emerald)
    emoji: "📖",
    file: "Al_Alaq.html",
    available: true
  },
  {
    id: "al-tin",
    num: 95,
    nameAr: "سورة التين",
    ayat: 8,
    parts: 2,
    type: "مكية",
    color: "#4A148C",  // violet
    emoji: "🌿",
    file: "Al_Tin.html",
    available: true
  },

  // ── Prochaines sourates ── ajouter ici quand prêtes ──────────────────────
  {
    id: "al-qadr",
    num: 97,
    nameAr: "سورة القدر",
    nameFr: "La Nuit du Destin",
    ayat: 5,
    parts: 1,
    type: "مكية",
    color: "#1e40af",
    emoji: "🌙",
    file: null,
    available: false
  },
  {
    id: "al-bayyina",
    num: 98,
    nameAr: "سورة البينة",
    nameFr: "La Preuve",
    ayat: 8,
    parts: 2,
    type: "مدنية",
    color: "#b45309",
    emoji: "📜",
    file: null,
    available: false
  },
  {
    id: "al-zalzala",
    num: 99,
    nameAr: "سورة الزلزلة",
    nameFr: "Le Séisme",
    ayat: 8,
    parts: 2,
    type: "مدنية",
    color: "#be123c",
    emoji: "⚡",
    file: null,
    available: false
  },
  {
    id: "al-adiyat",
    num: 100,
    nameAr: "سورة العاديات",
    nameFr: "Les Coursiers",
    ayat: 11,
    parts: 2,
    type: "مكية",
    color: "#0e7490",
    emoji: "⚔️",
    file: null,
    available: false
  },
  {
    id: "al-qaria",
    num: 101,
    nameAr: "سورة القارعة",
    nameFr: "Le Fracas",
    ayat: 11,
    parts: 2,
    type: "مكية",
    color: "#7c3aed",
    emoji: "🌪️",
    file: null,
    available: false
  },
  {
    id: "al-takathur",
    num: 102,
    nameAr: "سورة التكاثر",
    nameFr: "L'Accumulation",
    ayat: 8,
    parts: 2,
    type: "مكية",
    color: "#065f46",
    emoji: "💰",
    file: null,
    available: false
  },
  {
    id: "al-asr",
    num: 103,
    nameAr: "سورة العصر",
    nameFr: "Le Temps",
    ayat: 3,
    parts: 1,
    type: "مكية",
    color: "#92400e",
    emoji: "⏳",
    file: null,
    available: false
  },
  {
    id: "al-humaza",
    num: 104,
    nameAr: "سورة الهمزة",
    nameFr: "Le Calomniateur",
    ayat: 9,
    parts: 2,
    type: "مكية",
    color: "#3f3f46",
    emoji: "⚠️",
    file: null,
    available: false
  },
  {
    id: "al-fil",
    num: 105,
    nameAr: "سورة الفيل",
    nameFr: "L'Éléphant",
    ayat: 5,
    parts: 1,
    type: "مكية",
    color: "#6b7280",
    emoji: "🏔️",
    file: null,
    available: false
  },
  {
    id: "quraysh",
    num: 106,
    nameAr: "سورة قريش",
    nameFr: "Les Qoraïchites",
    ayat: 4,
    parts: 1,
    type: "مكية",
    color: "#78350f",
    emoji: "🕋",
    file: null,
    available: false
  },
  {
    id: "al-maun",
    num: 107,
    nameAr: "سورة الماعون",
    nameFr: "L'Ustensile",
    ayat: 7,
    parts: 1,
    type: "مكية",
    color: "#134e4a",
    emoji: "🕌",
    file: null,
    available: false
  },
  {
    id: "al-kawthar",
    num: 108,
    nameAr: "سورة الكوثر",
    nameFr: "L'Abondance",
    ayat: 3,
    parts: 1,
    type: "مكية",
    color: "#1e3a5f",
    emoji: "💧",
    file: null,
    available: false
  },
  {
    id: "al-kafirun",
    num: 109,
    nameAr: "سورة الكافرون",
    nameFr: "Les Mécréants",
    ayat: 6,
    parts: 1,
    type: "مكية",
    color: "#3b0764",
    emoji: "🕊️",
    file: null,
    available: false
  },
  {
    id: "al-nasr",
    num: 110,
    nameAr: "سورة النصر",
    nameFr: "Le Secours",
    ayat: 3,
    parts: 1,
    type: "مدنية",
    color: "#14532d",
    emoji: "🏆",
    file: null,
    available: false
  },
  {
    id: "al-masad",
    num: 111,
    nameAr: "سورة المسد",
    nameFr: "Les Fibres",
    ayat: 5,
    parts: 1,
    type: "مكية",
    color: "#7f1d1d",
    emoji: "🔥",
    file: null,
    available: false
  },
  {
    id: "al-ikhlas",
    num: 112,
    nameAr: "سورة الإخلاص",
    nameFr: "La Pureté",
    ayat: 4,
    parts: 1,
    type: "مكية",
    color: "#1e3a8a",
    emoji: "✨",
    file: null,
    available: false
  },
  {
    id: "al-falaq",
    num: 113,
    nameAr: "سورة الفلق",
    nameFr: "L'Aube",
    ayat: 5,
    parts: 1,
    type: "مكية",
    color: "#451a03",
    emoji: "🌅",
    file: null,
    available: false
  },
  {
    id: "al-nas",
    num: 114,
    nameAr: "سورة الناس",
    nameFr: "Les Hommes",
    ayat: 6,
    parts: 1,
    type: "مكية",
    color: "#0c4a6e",
    emoji: "🌍",
    file: null,
    available: false
  }
];
