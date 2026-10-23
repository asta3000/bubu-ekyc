import { clean, identifier, join, list, parseXml, toDate, unique } from "../utils";

const SUBJECT_TYPES = { Individual: "INDIVIDUAL", Entity: "ENTITY", Ship: "VESSEL" };

// Name1: нэр, Name2-5: дунд нэрс, Name6: овог эсвэл байгууллагын нэр
const fullName = (name) => join([name.Name1, name.Name2, name.Name3, name.Name4, name.Name5, name.Name6], " ");

// Их Британийн хоригийн жагсаалт (UK Sanctions List, XML)
export function parseUk(text) {
  const root = parseXml(text).Designations;

  const records = list(root.Designation).map((item) => {
    // Зарим бичлэгт хоосон "Primary Name" элемент байдаг тул нэргүйг хасна
    const names = list(item.Names?.Name).filter((name) => fullName(name));
    const primary =
      names.find((name) => clean(name.NameType).toLowerCase() === "primary name") ?? names[0];
    const person = item.IndividualDetails?.Individual ?? {};
    const entity = item.EntityDetails?.Entity ?? {};
    const ship = item.ShipDetails?.Ship ?? {};

    return {
      externalId: clean(item.UniqueID),
      subjectType: SUBJECT_TYPES[clean(item.IndividualEntityShip)] ?? "ENTITY",
      name: primary ? fullName(primary) : "",
      aliases: unique([
        ...names.filter((name) => name !== primary).map(fullName),
        ...list(item.NonLatinNames?.NonLatinName).map((name) => name.NameNonLatinScript),
      ]),
      // "dd/mm/1945" → "1945", "dd/05/1960" → "05/1960"
      birthDates: unique(list(person.DOBs?.DOB).map((dob) => clean(dob).replace(/^(dd\/)?(mm\/)?/, ""))),
      birthPlaces: unique(
        list(person.BirthDetails?.Location).map((l) => join([l.TownOfBirth, l.CountryOfBirth])),
      ),
      nationalities: unique(list(person.Nationalities?.Nationality)),
      addresses: unique(
        list(item.Addresses?.Address).map((a) =>
          join([
            a.AddressLine1,
            a.AddressLine2,
            a.AddressLine3,
            a.AddressLine4,
            a.AddressLine5,
            a.AddressLine6,
            a.AddressPostalCode,
            a.AddressCountry,
          ]),
        ),
      ),
      identifiers: unique([
        ...list(person.PassportDetails?.Passport).map((p) => identifier("Passport", p.PassportNumber)),
        ...list(person.NationalIdentifierDetails?.NationalIdentifier).map((n) =>
          identifier("National ID", n.NationalIdentifierNumber),
        ),
        ...list(entity.BusinessRegistrationNumbers?.BusinessRegistrationNumber).map((n) =>
          identifier("Registration", n),
        ),
        ...list(ship.IMONumbers?.IMONumber).map((n) => identifier("IMO", n)),
        ...list(ship.CurrentBelievedFlagOfShips?.CurrentBelievedFlagOfShip).map((f) => identifier("Flag", f)),
      ]),
      programs: unique([item.RegimeName, item.UNReferenceNumber]),
      remarks: join([item.SanctionsImposed, item.OtherInformation], ". ") || null,
      listedAt: toDate(item.DateDesignated),
    };
  });

  return { publishedAt: toDate(root.DateGenerated), records };
}
