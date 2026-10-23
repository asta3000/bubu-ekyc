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
];

export const SANCTION_SOURCE_KEYS = SANCTION_SOURCES.map((source) => source.key);

export const sanctionSource = (key) => SANCTION_SOURCES.find((source) => source.key === key);
