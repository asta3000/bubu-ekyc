// Хоригийн жагсаалтын эх сурвалжууд. key нь SANCTION_SOURCE enum-тай таарна.
// Client-д ч харуулдаг тул parser-ийг энд импортлохгүй (importer.js-д холбоно).
export const SANCTION_SOURCES = [
  {
    key: "UN",
    name: "НҮБ-ын нэгдсэн жагсаалт",
    description: "UN Security Council Consolidated List. Бүх улс заавал мөрдөнө.",
    url: "https://scsanctions.un.org/resources/xml/en/consolidated.xml",
    infoUrl: "https://main.un.org/securitycouncil/en/content/un-sc-consolidated-list",
  },
  {
    key: "EU",
    name: "Европын Холбооны жагсаалт",
    description: "Consolidated list of persons, groups and entities subject to EU financial sanctions.",
    url: "https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw",
    infoUrl:
      "https://data.europa.eu/data/datasets/consolidated-list-of-persons-groups-and-entities-subject-to-eu-financial-sanctions",
  },
  {
    key: "OFAC_SDN",
    name: "АНУ OFAC — SDN",
    description: "Specially Designated Nationals. Хөрөнгө царцаах, гүйлгээг бүрэн хориглоно.",
    url: "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.XML",
    infoUrl: "https://ofac.treasury.gov/sanctions-list-service",
  },
  {
    key: "OFAC_NON_SDN",
    name: "АНУ OFAC — Non-SDN",
    description: "Non-SDN Consolidated Sanctions List. Хэсэгчилсэн хязгаарлалт (SSI, CMIC г.м.).",
    url: "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/CONSOLIDATED.XML",
    infoUrl: "https://ofac.treasury.gov/sanctions-list-service",
  },
  {
    key: "UK",
    name: "Их Британийн жагсаалт",
    description: "UK Sanctions List.",
    url: "https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.xml",
    infoUrl: "https://www.gov.uk/government/publications/the-uk-sanctions-list",
  },
  {
    key: "US_CSL",
    name: "АНУ Consolidated Screening List",
    description: "BIS Entity List, Denied Persons List зэрэг барааг хүлээн авагч, илгээгчийн жагсаалт (OFAC-аас бусад).",
    url: "https://data.trade.gov/downloadable_consolidated_screening_list/v1/consolidated.json",
    infoUrl: "https://www.trade.gov/consolidated-screening-list",
  },
  {
    key: "EU_833_XLV",
    name: "ЕХ 833/2014 — XLV хавсралт",
    description:
      "Оросын эсрэг гүйлгээний хориг (5ad зүйл): хоригийг тойроход тусалж буй ЕХ-оос гадны банк, крипто, төлбөрийн үйлчилгээ үзүүлэгч.",
    // Татах файлгүй: хавсралтыг data/eu-833-annex-xlv.js-д хөтөлнө
    url: null,
    infoUrl: "https://eur-lex.europa.eu/eli/reg/2014/833",
  },
  {
    key: "WORLD_BANK",
    name: "Дэлхийн банкны хориглосон этгээд",
    description: "World Bank debarred firms and individuals. Дэлхийн банкны санхүүжилттэй төсөлд оролцох эрхгүй компани, хувь хүн.",
    // Албан ёсны вэб хуудасны ашигладаг API (apikey header-тэй, importer.js-д)
    url: "https://apigwext.worldbank.org/dvsvc/v1.0/json/APPLICATION/ADOBE_EXPRNCE_MGR/FIRM/SANCTIONED_FIRM",
    infoUrl: "https://www.worldbank.org/en/projects-operations/procurement/debarred-firms",
  },
  // ---- Улсын нэмэлт жагсаалтууд (addon: true) ----
  // Байгууллага "Багц, төлбөр" хэсгээс тусад нь худалдаж авсны дараа л тулгалтад ашиглана
  {
    key: "CA_SEMA",
    name: "Канадын жагсаалт",
    description: "Consolidated Canadian Autonomous Sanctions List (SEMA, JVCFOA).",
    url: "https://www.international.gc.ca/world-monde/assets/office_docs/international_relations-relations_internationales/sanctions/sema-lmes.xml",
    infoUrl:
      "https://www.international.gc.ca/world-monde/international_relations-relations_internationales/sanctions/consolidated-consolide.aspx?lang=eng",
    addon: true,
  },
  {
    key: "FR_GELS",
    name: "Францын жагсаалт",
    description: "Registre national des gels (DG Trésor). Францад хөрөнгө нь царцаагдсан этгээд.",
    url: "https://gels-avoirs.dgtresor.gouv.fr/ApiPublic/api/v1/publication/derniere-publication-fichier-json",
    infoUrl: "https://gels-avoirs.dgtresor.gouv.fr/",
    addon: true,
  },
  {
    key: "CH_SECO",
    name: "Швейцарийн жагсаалт",
    description: "SECO sanctions list. Швейцарийн эдийн засгийн хориг арга хэмжээний нэгдсэн жагсаалт.",
    url: "https://www.sesam.search.admin.ch/sesam-search-web/pages/downloadXmlGesamtliste.xhtml?lang=en&action=downloadXmlGesamtlisteAction",
    infoUrl: "https://www.seco.admin.ch/seco/en/home/Aussenwirtschaftspolitik_Wirtschaftliche_Zusammenarbeit/Wirtschaftsbeziehungen/exportkontrollen-und-sanktionen/sanktionen-embargos.html",
    addon: true,
  },
  {
    key: "JP_MOF",
    name: "Японы жагсаалт",
    description: "Японы Сангийн яамны хөрөнгө царцаах этгээдийн нэгдсэн жагсаалт (外為法 経済制裁措置対象者).",
    // Файлын нэрэнд огноо орсон тул энэ хуудаснаас хамгийн сүүлийн CSV-г олж татна (importer.js)
    url: "https://www.mof.go.jp/policy/international_policy/gaitame_kawase/gaitame/economic_sanctions/list.html",
    infoUrl: "https://www.mof.go.jp/policy/international_policy/gaitame_kawase/gaitame/economic_sanctions/list.html",
    addon: true,
  },
  {
    key: "AU_DFAT",
    name: "Австралийн жагсаалт",
    description: "DFAT Consolidated List. Австралийн НҮБ-ын болон бие даасан хоригийн нэгдсэн жагсаалт.",
    url: "https://www.dfat.gov.au/sites/default/files/Australian_Sanctions_Consolidated_List.xlsx",
    infoUrl: "https://www.dfat.gov.au/international-relations/security/sanctions/consolidated-list",
    addon: true,
  },
];

// Бүх байгууллагад багтах үндсэн ба тусад нь худалдаж авах нэмэлт жагсаалтууд
export const CORE_SOURCES = SANCTION_SOURCES.filter((source) => !source.addon);
export const ADDON_SOURCES = SANCTION_SOURCES.filter((source) => source.addon);
export const ADDON_SOURCE_KEYS = ADDON_SOURCES.map((source) => source.key);

// Байгууллагын өөрийн жагсаалтын бичлэг (SanctionEntry.listId-тэй). Админы импорт, нийтийн
// жагсаалтад орохгүй, зөвхөн тухайн байгууллагын тулгалтад ашиглагдана.
export const CUSTOM_SOURCE = { key: "CUSTOM", name: "Байгууллагын өөрийн жагсаалт" };

export const SANCTION_SOURCE_KEYS = SANCTION_SOURCES.map((source) => source.key);

export const sanctionSource = (key) =>
  key === CUSTOM_SOURCE.key ? CUSTOM_SOURCE : SANCTION_SOURCES.find((source) => source.key === key);

// Тохирлын бичлэгийн жагсаалтын нэр. Өөрийн жагсаалтынх бол жагсаалтын нэрийг нэмнэ.
export const entrySourceName = (entry) => {
  const name = sanctionSource(entry.source)?.name ?? entry.source;
  return entry.listName ? `${name}: ${entry.listName}` : name;
};
