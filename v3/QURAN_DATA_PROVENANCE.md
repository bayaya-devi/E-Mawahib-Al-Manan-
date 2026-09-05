# Quran data provenance

- Reading: Warsh an Nafi.
- Canonical text: `ara-quranwarsh`, version 8, exposed by `quran-api@1` from the King Fahd Glorious Quran Printing Complex source.
- Immutable import URL: `https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@6be8e17f2a0c13b1f33b1c3057f73cb28d5e848e/editions/ara-quranwarsh.min.json`.
- Imported source SHA-256: `bce3bd2ec734e17699ae0ee72e96510103fc5bf640da6f746006719e30b0cf65`.
- Canonical application checksum: `cc66440db8d48423adbf96a483d71855e2732eb816cf8e506264504b3f99dc7d`.
- Audio: EveryAyah, Ibrahim Al-Dosary, Warsh, 128 kbps; Yassin Al-Jazaery is the fallback.
- Licensing of the transport dataset: public domain (`quran-api` Unlicense). The Quran text is never generated or manually rewritten by this application.

Run `npm run quran:verify` after every corpus change and `npm run quran:verify-audio` when validating the remote audio inventory. Regenerate only through `npm run quran:import-warsh`; never edit an ayah by hand.
