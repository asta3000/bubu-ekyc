// Didit Verification API (https://docs.didit.me). Түлхүүрийг DIDIT_API_KEY-ээс уншина.
// Standalone API бүр save_api_request=true үед Didit дээр session болон хадгалагдаж,
// буцаасан request_id-аар GET /v3/session/{id}/decision/-оос үр дүнг дахин авч болно.

const BASE_URL = "https://verification.didit.me";

export class DiditError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// Didit-ийн алдааны хариуг ойлгомжтой мессеж болгоно
function errorMessage(status, body) {
  if (body?.error === "COULD_NOT_RECOGNIZE_DOCUMENT") {
    return "Зурган дээрээс бичиг баримт танигдсангүй. Дөрвөн булан нь харагдах тод зураг оруулна уу.";
  }
  if (status === 403 && body?.error) return "Didit-ийн кредит хүрэлцэхгүй байна. Админд хандана уу.";
  if (status === 401 || status === 403) return "Didit-ийн API түлхүүр буруу эсвэл эрхгүй байна.";
  if (status === 429) return "Didit-ийн хүсэлтийн хязгаар хэтэрлээ. Түр хүлээгээд дахин оролдоно уу.";
  if (status === 400 && body && typeof body === "object") {
    // { front_image: ["File size should not exceed 10 MB"] } г.м.
    const first = Object.values(body).flat()[0];
    if (typeof first === "string") return `Didit: ${first}`;
  }
  return `Didit-тэй холбогдоход алдаа гарлаа (HTTP ${status})`;
}

async function request(path, init = {}) {
  const apiKey = process.env.DIDIT_API_KEY;
  if (!apiKey) throw new DiditError("DIDIT_API_KEY тохируулаагүй байна", 500);

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { "x-api-key": apiKey, ...init.headers },
      signal: AbortSignal.timeout(60_000),
      cache: "no-store",
    });
  } catch {
    throw new DiditError("Didit-тэй холбогдож чадсангүй", 502);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new DiditError(errorMessage(res.status, body), res.status);
  return body;
}

const form = (fields) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value != null) data.append(key, value);
  }
  return data;
};

// Бичиг баримтын OCR + хуурамч эсэхийн шалгалт. { request_id, id_verification }
export const verifyDocument = ({ front, back, vendorData }) =>
  request("/v3/id-verification/", {
    method: "POST",
    body: form({
      front_image: front,
      back_image: back,
      perform_document_liveness: "true",
      // Кирилл бичвэртэй баримтаас латин галиглалыг авна (хоригийн жагсаалттай тулгахад)
      preferred_characters: "latin",
      save_api_request: "true",
      vendor_data: vendorData,
    }),
  });

// 1:1 нүүр тулгалт. reference: баримт бичгийн зураг, selfie: амьд зураг. { request_id, face_match }
export const matchFaces = ({ selfie, reference, threshold, vendorData }) =>
  request("/v3/face-match/", {
    method: "POST",
    body: form({
      user_image: selfie,
      ref_image: reference,
      face_match_score_decline_threshold: String(threshold),
      rotate_image: "true",
      save_api_request: "true",
      vendor_data: vendorData,
    }),
  });

// Session-ий бүрэн үр дүн. Зургууд нь богино хугацаанд хүчинтэй URL байдаг тул хадгалахгүй.
export const getDecision = (sessionId) =>
  request(`/v3/session/${encodeURIComponent(sessionId)}/decision/`);

// Didit-ийн media URL-аас зургийг татна (баримтын нүүрний зургийг face match-д дамжуулахад)
export async function downloadImage(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000), cache: "no-store" });
  if (!res.ok) throw new DiditError(`Зураг татаж чадсангүй (HTTP ${res.status})`, 502);
  const type = res.headers.get("content-type") ?? "image/jpeg";
  return new File([await res.blob()], "portrait.jpg", { type });
}
