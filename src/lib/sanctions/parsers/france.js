import { clean, identifier, join, list, unique } from "../utils";

const SUBJECT_TYPES = { "Personne physique": "INDIVIDUAL", "Personne morale": "ENTITY", Navire: "VESSEL" };

// Францын хөрөнгө царцаалтын үндэсний бүртгэл (DG Trésor, JSON). Бичлэг бүрийн
// мэдээлэл RegistreDetail-д { TypeChamp, Valeur: [...] } хэлбэрээр ирнэ.
export function parseFrance(text) {
  const root = JSON.parse(text).Publications ?? {};

  const records = list(root.PublicationDetail).map((item) => {
    const values = (type) => list(item.RegistreDetail).filter((f) => f.TypeChamp === type).flatMap((f) => list(f.Valeur));
    const given = values("PRENOM").map((v) => v.Prenom);

    return {
      externalId: clean(item.IdRegistre),
      subjectType: SUBJECT_TYPES[item.Nature] ?? "ENTITY",
      name: join([...given, item.Nom], " "),
      aliases: unique(values("ALIAS").map((v) => v.Alias)),
      birthDates: unique(
        values("DATE_DE_NAISSANCE").map((d) =>
          [d.Annee, clean(d.Mois).padStart(2, "0"), clean(d.Jour).padStart(2, "0")].filter((part) => clean(part) && part !== "00").join("-"),
        ),
      ),
      birthPlaces: unique(values("LIEU_DE_NAISSANCE").map((p) => join([p.Lieu, p.Pays]))),
      nationalities: unique(values("NATIONALITE").map((n) => n.Pays)),
      addresses: unique([...values("ADRESSE_PM"), ...values("ADRESSE_PP")].map((a) => join([a.Adresse, a.Pays]))),
      identifiers: unique([
        ...values("PASSEPORT").map((v) => identifier("Passeport", v.NumeroPasseport, v.Commentaire)),
        ...values("AUTRE_IDENTITE").map((v) => identifier(v.Commentaire, v.NumeroCarte)),
        // "/" г.м. утгагүй дугаартай мөрийг алгасна
        ...values("IDENTIFICATION")
          .filter((v) => /[0-9A-Za-z]/.test(clean(v.Identification)))
          .map((v) => identifier(v.Commentaire, v.Identification)),
        ...values("NUMERO_OMI").map((v) => identifier("IMO", v.NumeroOMI)),
      ]),
      programs: unique([
        ...values("FONDEMENT_JURIDIQUE").map((v) => v.FondementJuridiqueLabel),
        ...values("REFERENCE_UE").map((v) => v.ReferenceUe),
        ...values("REFERENCE_ONU").map((v) => v.ReferenceOnu),
      ]),
      remarks: join([...values("TITRE").map((v) => v.Titre), ...values("MOTIFS").map((v) => v.Motifs)], " ") || null,
      listedAt: null,
    };
  });

  return { publishedAt: root.DatePublication ? new Date(root.DatePublication) : null, records };
}
