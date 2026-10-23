import { normalize } from "./text";

// ISO 3166-1 alpha-2 кодууд
const CODES =
  "AF AX AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BV BR IO BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CD CG CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF TF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HM VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR XK KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI WF EH YE ZM ZW".split(
    " ",
  );

// Жагсаалтуудад англи нэрээс өөрөөр бичигддэг улсууд
const ALIASES = {
  RU: ["russia", "russian federation"],
  KP: ["north korea", "korea north", "democratic people s republic of korea", "dprk"],
  KR: ["south korea", "korea south", "republic of korea"],
  IR: ["iran", "islamic republic of iran"],
  SY: ["syria", "syrian arab republic"],
  VE: ["venezuela"],
  US: ["united states", "usa"],
  GB: ["united kingdom", "great britain"],
  MM: ["burma", "myanmar"],
  CD: ["democratic republic of the congo", "congo democratic republic"],
  CG: ["republic of the congo", "congo republic"],
  LA: ["laos", "lao"],
  VN: ["vietnam", "viet nam"],
  TR: ["turkey", "turkiye"],
  CZ: ["czech republic", "czechia"],
  PS: ["palestinian", "palestine", "west bank", "gaza"],
  MD: ["moldova"],
  BO: ["bolivia"],
  TZ: ["tanzania"],
  TW: ["taiwan"],
  CI: ["cote d ivoire", "ivory coast"],
};

const english = new Intl.DisplayNames(["en"], { type: "region" });
const mongolian = new Intl.DisplayNames(["mn"], { type: "region" });

// Сонголтын жагсаалт: { value: "MN", label: "Монгол" }
export const countryOptions = () =>
  CODES.map((code) => ({ value: code, label: mongolian.of(code) ?? code })).sort((a, b) =>
    a.label.localeCompare(b.label, "mn"),
  );

export const isCountryCode = (code) => CODES.includes(code);

export const countryLabel = (code) => (code ? mongolian.of(code) ?? code : "");

// Улсыг таних нэрс (нормчилсон)
export const countryNames = (code) =>
  [...new Set([english.of(code), ...(ALIASES[code] ?? [])].map(normalize).filter(Boolean))];
