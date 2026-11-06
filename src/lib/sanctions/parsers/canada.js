import { clean, join, list, parseXml, toDate, unique } from "../utils";

// Канадын бие даасан хоригийн нэгдсэн жагсаалт (XML). Талбарын нэр англи-франц хосоор.
// Бичлэгт дугаар байхгүй тул улс, хавсралт, зүйлийн дугаараар таниулна.
export function parseCanada(text) {
  const records = list(parseXml(text)["data-set"]?.record).map((item) => {
    const country = clean(item["Country-Pays"]);
    const schedule = clean(item["Schedule-Annexe"]);
    const entity = clean(item["EntityOrShip-EntiteOuNavire"]);
    const type = clean(item["TitleOrShipType-TitreOuTypeDeNavire"]);
    // Хөлөг онгоцны IMO нь 7 оронтой. Зарим мөрөнд энэ талбарт нэрийн өөр бичлэг байдаг.
    const imo = clean(item["ShipIMONumber-NumeroOMIDuNavire"]);
    const isImo = /^\d{7}$/.test(imo);

    return {
      externalId: join([country, schedule, item["Item-NumeroDarticle"]], "|"),
      subjectType: entity ? (isImo ? "VESSEL" : "ENTITY") : "INDIVIDUAL",
      name: entity || join([item["GivenName-Prenom"], item["LastName-NomDeFamille"]], " "),
      aliases: unique([...list(item["Aliases-Alias"]), isImo ? "" : imo]),
      // Хөлөг онгоцных бол барьсан огноо
      birthDates: entity ? [] : unique([item["DateOfBirthOrShipBuildDate-DateDeNaissanceOuDateDeConstructionDuNavire"]]),
      birthPlaces: [],
      nationalities: [],
      addresses: [],
      identifiers: isImo ? [`IMO: ${imo}`] : [],
      programs: unique([country, schedule && `Schedule ${schedule}`]),
      // Хувь хүнийх бол албан тушаал, хөлөг онгоцных бол төрөл
      remarks: type || null,
      listedAt: toDate(item["DateOfListing-DateDinscription"]),
    };
  });

  return { publishedAt: null, records };
}
