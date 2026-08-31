export const locales = ["ar", "fr", "en", "amz"] as const;
export type PublicLocale = (typeof locales)[number];
export const publicPages = ["home", "about", "programs", "schedule", "courses", "registration", "news", "replays", "faq", "contact"] as const;
export type PublicPage = (typeof publicPages)[number];

export const pagePaths: Record<PublicPage, string> = {
  home: "", about: "about", programs: "programs", schedule: "schedule",
  courses: "courses", registration: "registration", news: "news",
  replays: "replays", faq: "faq", contact: "contact",
};

type Copy = {
  brand: string; association: string; login: string; menu: string; language: string;
  nav: Record<PublicPage, string>;
  hero: { kicker: string; title: string; copy: string; primary: string; secondary: string; trust: string };
  about: { eyebrow: string; title: string; paragraphs: string[]; caption: string };
  programs: { eyebrow: string; title: string; intro: string; items: Array<{ title: string; copy: string }> };
  schedule: { eyebrow: string; title: string; intro: string; empty: string };
  courses: { eyebrow: string; title: string; intro: string; items: string[] };
  registration: { eyebrow: string; title: string; copy: string; fee: string; documents: string; items: string[] };
  news: { eyebrow: string; title: string; intro: string; empty: string };
  replays: { eyebrow: string; title: string; intro: string; empty: string; views: string; likes: string; share: string };
  faq: { eyebrow: string; title: string; items: Array<{ q: string; a: string }> };
  contact: { eyebrow: string; title: string; copy: string; phone: string; address: string; map: string };
  footer: string;
};

export const publicCopy: Record<PublicLocale, Copy> = {
  ar: {
    brand: "دار الحديث والقرآن", association: "جمعية مواهب المنان", login: "دخول المنصة", menu: "القائمة", language: "اللغة",
    nav: { home: "الرئيسية", about: "تقديم", programs: "البرامج", schedule: "الحصص", courses: "الدروس", registration: "التسجيل", news: "الأخبار", replays: "المحاضرات", faq: "الأسئلة", contact: "تواصل معنا" },
    hero: { kicker: "جمعية مواهب المنان · عين العودة", title: "دار الحديث والقرآن", copy: "فضاء لتعليم القرآن الكريم بقواعد التجويد، وتعليم السنة النبوية والقيم الإسلامية للرجال والنساء والأطفال ابتداء من خمس سنوات.", primary: "معلومات التسجيل", secondary: "اكتشف البرامج", trust: "تعليم متدرج · تجويد · سنة وقيم" },
    about: { eyebrow: "التعريف بالجمعية", title: "تعليم القرآن في بيئة تربوية هادئة ومنظمة", paragraphs: ["تستقبل جمعية مواهب المنان بعين العودة الرجال والنساء والأطفال في دار الحديث والقرآن، لتعلم كتاب الله تعالى والقراءة الصحيحة بقواعد التجويد.", "يسير البرنامج خطوة بخطوة، ويجمع بين تعلم القرآن الكريم والسنة النبوية والقيم الإسلامية."], caption: "فضاء مهيأ للتعلم والحفظ والمراجعة" },
    programs: { eyebrow: "البرنامج التربوي", title: "ماذا يتعلم المستفيدون؟", intro: "مسارات واضحة تراعي التدرج والاستمرار.", items: [{ title: "القرآن الكريم", copy: "تعليم القرآن للرجال والنساء والأطفال ابتداء من خمس سنوات." }, { title: "قواعد التجويد", copy: "تعلم القواعد التي تساعد على قراءة كتاب الله قراءة صحيحة." }, { title: "السنة النبوية", copy: "تعليم السنة النبوية والقيم الإسلامية بأسلوب واضح ومناسب." }] },
    schedule: { eyebrow: "الأوقات", title: "مواعيد الحصص", intro: "المواعيد المنشورة من الإدارة تظهر هنا مباشرة.", empty: "لا توجد مواعيد منشورة حاليا." },
    courses: { eyebrow: "التعلّم", title: "دروس تناسب مراحل مختلفة", intro: "تعليم حضوري منظم يدعم الحفظ والقراءة والمراجعة.", items: ["الحفظ والمراجعة", "تصحيح القراءة", "التجويد", "السنة والقيم"] },
    registration: { eyebrow: "التسجيل", title: "ملف بسيط للالتحاق بالدار", copy: "التسجيل مفتوح للرجال والنساء والأطفال. ولتسجيل طفل ابتداء من خمس سنوات، يرجى إعداد الوثائق التالية والتواصل مع الإدارة.", fee: "الواجب الشهري", documents: "الوثائق المطلوبة", items: ["عقد ازدياد التلميذ", "نسخة من بطاقة التعريف الوطنية لولي الأمر", "رقم هاتف الأب أو الأم"] },
    news: { eyebrow: "آخر المستجدات", title: "أخبار الجمعية", intro: "الإعلانات والأنشطة المنشورة من الإدارة.", empty: "لا توجد أخبار منشورة حاليا." },
    replays: { eyebrow: "المكتبة المرئية", title: "المحاضرات والإعادات", intro: "شاهد المحاضرات واللقاءات المنشورة.", empty: "لا توجد محاضرات منشورة حاليا.", views: "مشاهدة", likes: "إعجاب", share: "مشاركة" },
    faq: { eyebrow: "معلومات عملية", title: "أسئلة متكررة", items: [{ q: "لمن تفتح الدار أبوابها؟", a: "للرجال والنساء والأطفال ابتداء من خمس سنوات بحسب البرامج المتاحة." }, { q: "كيف يتم التسجيل؟", a: "يتم التواصل مع الإدارة وإعداد الوثائق المطلوبة." }, { q: "أين توجد الدار؟", a: "في عين العودة، وتوجد الخريطة وبيانات الاتصال في صفحة التواصل." }] },
    contact: { eyebrow: "تواصل معنا", title: "مرحبا بكم في عين العودة", copy: "للاستفسار عن التسجيل والبرامج، تواصلوا مباشرة مع إدارة الجمعية.", phone: "الهاتف", address: "العنوان", map: "فتح الخريطة" }, footer: "جمعية مواهب المنان · دار الحديث والقرآن",
  },
  fr: {
    brand: "Dar Al Hadith et du Coran", association: "Association Mawahib Al Manan", login: "Se connecter", menu: "Menu", language: "Langue",
    nav: { home: "Accueil", about: "Présentation", programs: "Programmes", schedule: "Horaires", courses: "Cours", registration: "Inscriptions", news: "Actualités", replays: "Conférences", faq: "FAQ", contact: "Contact" },
    hero: { kicker: "Association Mawahib Al Manan · Ain El Aouda", title: "Dar Al Hadith et du Coran", copy: "Un espace d’apprentissage du Coran, du tajwid, de la Sunna et des valeurs islamiques pour les hommes, les femmes et les enfants dès cinq ans.", primary: "Informations d’inscription", secondary: "Découvrir les programmes", trust: "Progression · Tajwid · Sunna et valeurs" },
    about: { eyebrow: "L’association", title: "Apprendre le Coran dans un cadre sérieux et bienveillant", paragraphs: ["À Ain El Aouda, l’Association Mawahib Al Manan accueille les hommes, les femmes et les enfants pour apprendre le Livre d’Allah et améliorer leur lecture grâce au tajwid.", "Le programme propose une progression claire associant Coran, Sunna et valeurs islamiques."], caption: "Un espace préparé pour apprendre, mémoriser et réviser" },
    programs: { eyebrow: "Programme éducatif", title: "Que peuvent apprendre les bénéficiaires ?", intro: "Des parcours clairs fondés sur la progression et la régularité.", items: [{ title: "Le Saint Coran", copy: "Enseignement pour hommes, femmes et enfants dès cinq ans." }, { title: "Règles du tajwid", copy: "Les règles nécessaires à une lecture correcte du Livre d’Allah." }, { title: "La Sunna", copy: "La Sunna et les valeurs islamiques dans un langage accessible." }] },
    schedule: { eyebrow: "Organisation", title: "Horaires des cours", intro: "Les horaires publiés par l’administration apparaissent ici.", empty: "Aucun horaire n’est publié actuellement." },
    courses: { eyebrow: "Apprentissage", title: "Des cours adaptés à plusieurs niveaux", intro: "Un enseignement présentiel structuré pour mémoriser, lire et réviser.", items: ["Mémorisation et révision", "Correction de la lecture", "Tajwid", "Sunna et valeurs"] },
    registration: { eyebrow: "Inscriptions", title: "Un dossier simple pour rejoindre le centre", copy: "Les inscriptions sont ouvertes aux hommes, aux femmes et aux enfants. Pour un enfant dès cinq ans, préparez les documents suivants et contactez l’administration.", fee: "Frais mensuels", documents: "Documents demandés", items: ["Acte de naissance de l’élève", "Copie de la carte d’identité d’un parent", "Numéro de téléphone du parent"] },
    news: { eyebrow: "Dernières informations", title: "Actualités de l’association", intro: "Les annonces et activités publiées par l’administration.", empty: "Aucune actualité n’est publiée actuellement." },
    replays: { eyebrow: "Médiathèque", title: "Conférences et replays", intro: "Retrouvez les conférences et rencontres publiées.", empty: "Aucun replay n’est publié actuellement.", views: "vues", likes: "J’aime", share: "Partager" },
    faq: { eyebrow: "Informations pratiques", title: "Questions fréquentes", items: [{ q: "À qui s’adresse le centre ?", a: "Aux hommes, aux femmes et aux enfants dès cinq ans selon les programmes disponibles." }, { q: "Comment s’inscrire ?", a: "Contactez l’administration et préparez les documents indiqués." }, { q: "Où se trouve le centre ?", a: "À Ain El Aouda. La carte et les coordonnées figurent sur la page Contact." }] },
    contact: { eyebrow: "Contact", title: "Bienvenue à Ain El Aouda", copy: "Pour toute question sur les inscriptions ou les programmes, contactez directement l’administration.", phone: "Téléphone", address: "Adresse", map: "Ouvrir la carte" }, footer: "Association Mawahib Al Manan · Dar Al Hadith et du Coran",
  },
  en: {
    brand: "Dar Al Hadith and Quran", association: "Mawahib Al Manan Association", login: "Sign in", menu: "Menu", language: "Language",
    nav: { home: "Home", about: "About", programs: "Programs", schedule: "Schedule", courses: "Courses", registration: "Registration", news: "News", replays: "Replays", faq: "FAQ", contact: "Contact" },
    hero: { kicker: "Mawahib Al Manan Association · Ain El Aouda", title: "Dar Al Hadith and Quran", copy: "A place to learn the Quran, tajwid, the Prophetic Sunnah and Islamic values for men, women and children from five years old.", primary: "Registration information", secondary: "Explore programs", trust: "Progression · Tajwid · Sunnah and values" },
    about: { eyebrow: "About us", title: "Learning the Quran in a serious and supportive setting", paragraphs: ["In Ain El Aouda, Mawahib Al Manan welcomes men, women and children to learn the Book of Allah and improve their recitation through tajwid.", "The program offers clear, gradual learning that brings together the Quran, Sunnah and Islamic values."], caption: "A space prepared for learning, memorisation and revision" },
    programs: { eyebrow: "Educational program", title: "What can learners study?", intro: "Clear paths built around steady progress and consistency.", items: [{ title: "The Holy Quran", copy: "Quran teaching for men, women and children from age five." }, { title: "Tajwid rules", copy: "The rules required to recite the Book of Allah correctly." }, { title: "The Prophetic Sunnah", copy: "The Sunnah and Islamic values in clear, accessible language." }] },
    schedule: { eyebrow: "Organisation", title: "Class schedule", intro: "Schedules published by the administration appear here.", empty: "No schedule is currently published." },
    courses: { eyebrow: "Learning", title: "Courses for different levels", intro: "Structured in-person teaching for memorisation, reading and revision.", items: ["Memorisation and revision", "Reading correction", "Tajwid", "Sunnah and values"] },
    registration: { eyebrow: "Registration", title: "A simple application file", copy: "Registration is open to men, women and children. To enrol a child from age five, prepare the following documents and contact the administration.", fee: "Monthly fee", documents: "Required documents", items: ["Student birth certificate", "Copy of a parent’s identity card", "Parent telephone number"] },
    news: { eyebrow: "Latest updates", title: "Association news", intro: "Announcements and activities published by the administration.", empty: "No news is currently published." },
    replays: { eyebrow: "Media library", title: "Conferences and replays", intro: "Watch published conferences and meetings.", empty: "No replay is currently published.", views: "views", likes: "Like", share: "Share" },
    faq: { eyebrow: "Practical information", title: "Frequently asked questions", items: [{ q: "Who can join?", a: "Men, women and children from age five, depending on available programs." }, { q: "How do I register?", a: "Contact the administration and prepare the listed documents." }, { q: "Where is the centre?", a: "In Ain El Aouda. The map and contact details are on the Contact page." }] },
    contact: { eyebrow: "Contact", title: "Welcome to Ain El Aouda", copy: "For registration and program enquiries, contact the association administration directly.", phone: "Telephone", address: "Address", map: "Open map" }, footer: "Mawahib Al Manan Association · Dar Al Hadith and Quran",
  },
  amz: {
    brand: "ⴷⴰⵔ ⵍⵃⴷⵉⵜ ⴷ ⵍⵇⵔⴰⵏ", association: "ⵜⴰⵎⵓⵏⵜ ⵎⴰⵡⴰⵀⵉⴱ ⴰⵍ ⵎⴰⵏⴰⵏ", login: "ⴽⵛⵎ ⵖⵔ ⵜⵎⵏⵣⴰⵢⵜ", menu: "ⴰⵎⵓⵖ", language: "ⵜⵓⵜⵍⴰⵢⵜ",
    nav: { home: "ⴰⵙⵏⵓⴱⴳ", about: "ⴼⵍⵍⴰⵏⵖ", programs: "ⵉⵙⵏⴼⴰⵔⵏ", schedule: "ⵉⵣⵎⴰⵣ", courses: "ⵜⵉⵖⵔⵉⵡⵉⵏ", registration: "ⴰⵙⵉⵊⵊⵍ", news: "ⵉⵏⵖⵎⵉⵙⵏ", replays: "ⵜⵉⵎⵍⵉⵍⵉⵏ", faq: "ⵉⵙⵇⵙⵉⵜⵏ", contact: "ⴰⵏⵎⵢⴰⵡⴰⴹ" },
    hero: { kicker: "ⵜⴰⵎⵓⵏⵜ ⵎⴰⵡⴰⵀⵉⴱ ⴰⵍ ⵎⴰⵏⴰⵏ · ⵄⵉⵏ ⵍⵄⵓⴷⴰ", title: "ⴷⴰⵔ ⵍⵃⴷⵉⵜ ⴷ ⵍⵇⵔⴰⵏ", copy: "ⴰⵎⴽⴰⵏ ⵏ ⵜⵖⵔⵉ ⵏ ⵍⵇⵔⴰⵏ ⴷ ⵜⵊⵡⵉⴷ ⴷ ⵙⵙⵓⵏⵏⴰ ⴷ ⵡⴰⵣⴰⵍⵏ ⵉ ⵉⵔⴳⴰⵣⵏ ⴷ ⵜⵍⴰⵡⵉⵏ ⴷ ⵉⴼⵔⵅⴰⵏ ⵙⴳ 5 ⵏ ⵉⵙⴳⴳⴰⵙⵏ.", primary: "ⵜⴰⵍⵖⵓⵜ ⵏ ⵓⵙⵉⵊⵊⵍ", secondary: "ⵙⵙⵏ ⵉⵙⵏⴼⴰⵔⵏ", trust: "ⵜⵖⵔⵉ ⵙ ⵓⵙⵓⴷⵙ · ⵜⵊⵡⵉⴷ · ⵙⵙⵓⵏⵏⴰ" },
    about: { eyebrow: "ⴼⵍⵍⴰⵏⵖ", title: "ⵜⵖⵔⵉ ⵏ ⵍⵇⵔⴰⵏ ⴳ ⵓⵎⴽⴰⵏ ⵉⵙⵓⴷⵙⵏ ⴷ ⵉⵀⵏⵏⴰ", paragraphs: ["ⴳ ⵄⵉⵏ ⵍⵄⵓⴷⴰ, ⵜⴰⵎⵓⵏⵜ ⴰⵔ ⵜⵜⵇⴱⴰⵍ ⵉⵔⴳⴰⵣⵏ ⴷ ⵜⵍⴰⵡⵉⵏ ⴷ ⵉⴼⵔⵅⴰⵏ ⴰⴷ ⵖⵔⵏ ⵍⵇⵔⴰⵏ ⵙ ⵜⵊⵡⵉⴷ.", "ⴰⵙⵏⴼⴰⵔ ⴰⵔ ⵉⵜⵜⴷⴷⵓ ⵙ ⵜⵔⴰⵢⵜ ⵉⴱⵢⵢⵏⵏ, ⵉⵙⵎⵓⵏ ⵍⵇⵔⴰⵏ ⴷ ⵙⵙⵓⵏⵏⴰ ⴷ ⵡⴰⵣⴰⵍⵏ."], caption: "ⴰⵎⴽⴰⵏ ⵉⵙⵓⴷⵙⵏ ⵉ ⵜⵖⵔⵉ ⴷ ⵍⵃⵉⴼⴹ ⴷ ⵓⵙⵎⴽⵜⵉ" },
    programs: { eyebrow: "ⴰⵙⵏⴼⴰⵔ ⴰⵜⵔⴱⴰⵡⵉ", title: "ⵎⴰⴷ ⵔⴰⴷ ⵍⵎⴷⵏ ⵉⵎⵙⵜⴼⵉⴷⵏ?", intro: "ⵉⴱⵔⵉⴷⵏ ⵉⴱⵢⵢⵏⵏ ⵙ ⵓⵙⵓⴷⵙ.", items: [{ title: "ⵍⵇⵔⴰⵏ ⴰⵎⵇⵔⴰⵏ", copy: "ⵜⵖⵔⵉ ⵏ ⵍⵇⵔⴰⵏ ⵉ ⴽⵓⵍⵍⵓ ⵙⴳ 5 ⵏ ⵉⵙⴳⴳⴰⵙⵏ." }, { title: "ⵉⵍⵓⴳⴰⵏ ⵏ ⵜⵊⵡⵉⴷ", copy: "ⵜⵖⵔⵉ ⵉⵚⵃⴰⵏ ⵏ ⵍⵇⵔⴰⵏ." }, { title: "ⵙⵙⵓⵏⵏⴰ ⵏ ⵏⵏⴱⵉ", copy: "ⵜⵖⵔⵉ ⵏ ⵙⵙⵓⵏⵏⴰ ⴷ ⵡⴰⵣⴰⵍⵏ." }] },
    schedule: { eyebrow: "ⵉⵣⵎⴰⵣ", title: "ⵉⵣⵎⴰⵣ ⵏ ⵜⵖⵔⵉ", intro: "ⵉⵣⵎⴰⵣ ⵏ ⵍⵉⴷⴰⵔⴰ ⴰⴷ ⴷ ⴱⴰⵏⵏ ⴷⴰ.", empty: "ⵓⵔ ⵜⵍⵍⵉ ⵜⵖⵔⵉ ⵉⴼⴼⵖⵏ ⵖⵉⵍⴰⴷ." },
    courses: { eyebrow: "ⵜⵖⵔⵉ", title: "ⵜⵉⵖⵔⵉⵡⵉⵏ ⵉ ⵉⵙⵡⵉⵔⵏ", intro: "ⵜⵖⵔⵉ ⵙ ⵓⵙⵓⴷⵙ ⵉ ⵍⵃⵉⴼⴹ ⴷ ⵜⵖⵔⵉ ⴷ ⵓⵙⵎⴽⵜⵉ.", items: ["ⵍⵃⵉⴼⴹ ⴷ ⵓⵙⵎⴽⵜⵉ", "ⵜⵖⵔⵉ ⵉⵚⵃⴰⵏ", "ⵜⵊⵡⵉⴷ", "ⵙⵙⵓⵏⵏⴰ ⴷ ⵡⴰⵣⴰⵍⵏ"] },
    registration: { eyebrow: "ⴰⵙⵉⵊⵊⵍ", title: "ⴰⴽⴰⵔⴹⴰⵙ ⴰⴼⵙⵙⴰⵙ ⵉ ⵓⴽⵛⵎ", copy: "ⴰⵙⵉⵊⵊⵍ ⵉⵍⴷⵉ ⵉ ⵉⵔⴳⴰⵣⵏ ⴷ ⵜⵍⴰⵡⵉⵏ ⴷ ⵉⴼⵔⵅⴰⵏ.", fee: "ⴰⵡⴷⴰⵢ ⵏ ⵢⵢⵓⵔ", documents: "ⵜⵉⴼⵔⵜⵉⵏ ⵍⵍⵉ ⵉⵍⴰⵇⵏ", items: ["ⵜⴰⴼⵔⵜ ⵏ ⵜⵍⴰⵍⵉⵜ ⵏ ⵓⵏⵍⵎⴰⴷ", "ⵜⴰⵏⵖⵍⵜ ⵏ ⵜⴽⴰⵔⴹⴰ ⵏ ⵓⵡⴰⵍⵉⴷ", "ⵏⵓⵎⵉⵔⵓ ⵏ ⵜⵉⵍⵉⴼⵓⵏ ⵏ ⵉⵎⵎⴰⵍⴰⵏ"] },
    news: { eyebrow: "ⵉⵏⵖⵎⵉⵙⵏ", title: "ⵉⵏⵖⵎⵉⵙⵏ ⵏ ⵜⵎⵓⵏⵜ", intro: "ⵜⵉⵍⵖⴰ ⴷ ⵜⵉⵔⵎⴰⴷ ⵏ ⵍⵉⴷⴰⵔⴰ.", empty: "ⵓⵔ ⵍⵍⵉⵏ ⵉⵏⵖⵎⵉⵙⵏ ⵉⴼⴼⵖⵏ ⵖⵉⵍⴰⴷ." },
    replays: { eyebrow: "ⵜⴰⵎⴽⴰⵔⴹⴰ ⵏ ⵜⵡⵍⴰⴼⵜ", title: "ⵜⵉⵎⵍⵉⵍⵉⵏ ⴷ ⵉⵔⵉⵔⵏ", intro: "ⵥⵕ ⵜⵉⵎⵍⵉⵍⵉⵏ ⵉⴼⴼⵖⵏ.", empty: "ⵓⵔ ⵜⵍⵍⵉ ⵜⵎⵍⵉⵍⵜ ⵉⴼⴼⵖⵏ.", views: "ⵜⵉⵎⵔⵉⵡⵉⵏ", likes: "ⵜⴰⵔⴰ", share: "ⴱⴹⵓ" },
    faq: { eyebrow: "ⵜⴰⵍⵖⵓⵜ", title: "ⵉⵙⵇⵙⵉⵜⵏ", items: [{ q: "ⵎⴰⵏ ⵡⵉ ⵉⵣⵎⵔⵏ ⴰⴷ ⵉⴽⵛⵎ?", a: "ⵉⵔⴳⴰⵣⵏ ⴷ ⵜⵍⴰⵡⵉⵏ ⴷ ⵉⴼⵔⵅⴰⵏ ⵙⴳ 5 ⵏ ⵉⵙⴳⴳⴰⵙⵏ." }, { q: "ⵎⴰⵎⴽ ⴰⴷ ⵙⵙⵉⵊⵊⵍⵖ?", a: "ⵏⵎⵢⴰⵡⴰⴹ ⴷ ⵍⵉⴷⴰⵔⴰ ⵜⵙⵙⵓⴷⵙⴷ ⵜⵉⴼⵔⵜⵉⵏ." }, { q: "ⵎⴰⵏⵉ ⵜⵍⵍⴰ ⴷⴷⴰⵔ?", a: "ⴳ ⵄⵉⵏ ⵍⵄⵓⴷⴰ. ⵜⴰⴽⴰⵔⴹⴰ ⵜⵍⵍⴰ ⴳ ⵜⴰⵙⵏⴰ ⵏ ⵓⵏⵎⵢⴰⵡⴰⴹ." }] },
    contact: { eyebrow: "ⴰⵏⵎⵢⴰⵡⴰⴹ", title: "ⵎⴰⵔⵃⴱⴰ ⵙⵡⵏ ⴳ ⵄⵉⵏ ⵍⵄⵓⴷⴰ", copy: "ⵉ ⵓⵙⵇⵙⵉ ⵖⴼ ⵓⵙⵉⵊⵊⵍ ⴷ ⵉⵙⵏⴼⴰⵔⵏ, ⵏⵎⵢⴰⵡⴰⴹⴰⵜ ⴷ ⵍⵉⴷⴰⵔⴰ.", phone: "ⵜⵉⵍⵉⴼⵓⵏ", address: "ⴰⵏⵙⴰ", map: "ⵍⴷⵉ ⵜⴰⴽⴰⵔⴹⴰ" }, footer: "ⵜⴰⵎⵓⵏⵜ ⵎⴰⵡⴰⵀⵉⴱ ⴰⵍ ⵎⴰⵏⴰⵏ · ⴷⴰⵔ ⵍⵃⴷⵉⵜ ⴷ ⵍⵇⵔⴰⵏ",
  },
};

export function isPublicLocale(value: string): value is PublicLocale { return locales.includes(value as PublicLocale); }
export function pageFromPath(value?: string): PublicPage | null {
  if (!value) return "home";
  return (Object.entries(pagePaths).find(([, path]) => path === value)?.[0] as PublicPage | undefined) ?? null;
}
export function publicHref(locale: PublicLocale, page: PublicPage) { const path = pagePaths[page]; return `/${locale}${path ? `/${path}` : ""}`; }
export function localeDirection(locale: PublicLocale) { return locale === "ar" ? "rtl" : "ltr"; }
