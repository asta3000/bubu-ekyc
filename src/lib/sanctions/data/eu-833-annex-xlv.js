// ЕХ-ны 833/2014 журмын XLV хавсралт (5ad зүйлийн гүйлгээний хориг). Эх сурвалж нь
// машинаар уншигдах файлгүй (EUR-Lex зөвхөн хөтчөөр нээгддэг) тул хавсралтыг энд гараар хөтөлнө.
// Хавсралт өөрчлөгдөхөд энэ файлыг шинэчилж, CONSOLIDATED_VERSION-ийг солиод импортлоно.
// Эх: https://eur-lex.europa.eu/eli/reg/2014/833 (нэгтгэсэн хувилбар 02014R0833-20260724)

export const CONSOLIDATED_VERSION = "2026-07-24";

export const PARTS = {
  A: "Part A: ЕХ-оос гадна байгуулагдсан, 833/2014 ба 269/2014 журмын хоригийн зорилгыг ихээхэн алдагдуулж буй санхүүгийн байгууллага, крипто, төлбөрийн үйлчилгээ үзүүлэгч",
  B: "Part B: ЕХ-оос гадна байгуулагдсан, Оросын Украины эсрэг түрэмгийллийн дайныг дэмжиж буй санхүүгийн байгууллага, крипто, төлбөрийн үйлчилгээ үзүүлэгч",
  C: "Part C: ЕХ-оос гадна байгуулагдсан, 3m, 3n, 3s зүйлийн хоригийн зорилгыг ихээхэн алдагдуулж буй этгээд",
  D: "Part D: ЕХ-оос гадна байгуулагдсан, хоригийг тойрч олон улсын төлбөр тооцоо (netting, set-off г.м.) гүйцэтгэх боломж олгож буй этгээд",
};

// name: хавсралтад бичигдсэнээр. Хаалтан доторх нэр нь aliases, улс нь country.
// appliesFrom: "Entry into force" багана
export const ENTRIES = [
  { part: "A", name: "Payeer", appliesFrom: "2025-11-25" },
  { part: "A", name: "CJSB JSCB Tolubay", appliesFrom: "2025-11-12" },
  { part: "A", name: "OJSC Eurasian Savings Bank", appliesFrom: "2025-11-12" },
  { part: "A", name: "Joint Development Bank", country: "Laos", appliesFrom: "2026-05-14" },
  { part: "A", name: "Rapira", appliesFrom: "2026-08-23" },
  { part: "A", name: "Aifory Pro", aliases: ["Sooty Ltd."], appliesFrom: "2026-08-23" },
  { part: "A", name: "ABCeX", aliases: ["Nueva Cryptologia S.A.S DE C.V."], appliesFrom: "2026-08-23" },
  { part: "A", name: "WhiteBird", appliesFrom: "2026-08-23" },
  { part: "A", name: "NoOnecrypto INC.", appliesFrom: "2026-08-23" },
  { part: "A", name: "Tradex", aliases: ["Brightum LLC"], appliesFrom: "2026-08-23" },
  { part: "A", name: "Monease Ltd", appliesFrom: "2026-08-23" },
  { part: "A", name: "BitPapa", appliesFrom: "2026-08-23" },
  { part: "A", name: "Exnode", aliases: ["Exnode Pay", "Arvix"], appliesFrom: "2026-08-23" },
  { part: "A", name: "HTX", aliases: ["HUOBI GLOBAL SA"], appliesFrom: "2026-08-23" },
  { part: "A", name: "EXMO Ltd", appliesFrom: "2026-08-23" },
  { part: "A", name: "Chinggis Khaan Bank", appliesFrom: "2026-08-13" },
  { part: "A", name: "Sberbank India", appliesFrom: "2026-08-13" },
  { part: "A", name: "India VTB", appliesFrom: "2026-08-13" },
  { part: "A", name: "A7 Nigeria", appliesFrom: "2026-08-13" },
  { part: "A", name: "A7 Africa", appliesFrom: "2026-08-13" },
  { part: "A", name: "PilotFinance Ltd", appliesFrom: "2026-08-13" },
  { part: "B", name: "Keremet bank", country: "Kyrgyzstan", appliesFrom: "2026-05-14" },
  { part: "B", name: "OJSC Capital Bank of Central Asia", country: "Kyrgyzstan", appliesFrom: "2026-05-14" },
  { part: "C", name: "Blackford Corporation Limited", appliesFrom: "2025-11-12" },
  { part: "C", name: "Fuel and Oil Dynamics FZE", appliesFrom: "2025-11-12" },
  { part: "C", name: "Vistula Delta Global FZE", appliesFrom: "2026-08-13" },
  { part: "C", name: "Estrella Integrated FZE", appliesFrom: "2026-08-13" },
  { part: "C", name: "Linglong Trading Group FZE", appliesFrom: "2026-08-13" },
  { part: "C", name: "Arcadia International FZE", appliesFrom: "2026-08-13" },
  { part: "C", name: "Nexus Oil Trading FZCO", appliesFrom: "2026-08-13" },
  { part: "D", name: "Arneis", appliesFrom: "2026-05-14" },
  { part: "D", name: "Asia Import Group", appliesFrom: "2026-05-14" },
  { part: "D", name: "GPAgent", appliesFrom: "2026-05-14" },
  { part: "D", name: "Platejka", appliesFrom: "2026-05-14" },
];
