// Didit-ийн хариуг өөрийн IdentityVerification бичлэг болгоно

// Сельфиг ийм онооноос (0-100) дээш бол ижил хүн гэж үзнэ. Didit-ийн анхны утга 30
// хэт зөөлөн тул KYC-д чангатгав.
export const FACE_MATCH_THRESHOLD = 60;

const toWarning = (warning) => ({
  feature: warning.feature ?? null,
  risk: warning.risk,
  logType: warning.log_type ?? null,
  description: warning.short_description ?? warning.risk,
  details: warning.long_description ?? null,
});

// Хадгалах түүхий хариунаас зураг (богино хугацааны URL) болон том geocoding өгөгдлийг хасна
function stripDocument(idv) {
  const {
    portrait_image,
    front_image,
    back_image,
    front_image_camera_front,
    back_image_camera_front,
    parsed_address,
    ...rest
  } = idv;
  if (!parsed_address) return { ...rest, parsed_address: null };
  const { raw_results, ...address } = parsed_address;
  return { ...rest, parsed_address: address };
}

// faceMatch: { request_id, face_match } эсвэл { error: "мессеж" } (нүүр тулгалт хийгдээгүй)
export function buildVerification({ document, faceMatch }) {
  const idv = document.id_verification ?? {};
  const fm = faceMatch.face_match ?? null;

  const warnings = [...(idv.warnings ?? []), ...(fm?.warnings ?? [])].map(toWarning);
  if (faceMatch.error) {
    warnings.push({ feature: "FACEMATCH", risk: "FACE_MATCH_NOT_PERFORMED", logType: "error", description: faceMatch.error, details: null });
  }

  return {
    status: idv.status === "Approved" && fm?.status === "Approved" ? "APPROVED" : "DECLINED",
    documentSessionId: document.request_id ?? null,
    faceMatchSessionId: faceMatch.request_id ?? null,
    documentStatus: idv.status ?? null,
    faceMatchStatus: fm?.status ?? null,
    faceMatchScore: fm?.score ?? null,
    faceMatchThreshold: FACE_MATCH_THRESHOLD,
    documentType: idv.document_type ?? null,
    documentNumber: idv.document_number ?? null,
    personalNumber: idv.personal_number ?? null,
    firstName: idv.first_name ?? null,
    lastName: idv.last_name ?? null,
    fullName: idv.full_name ?? null,
    dateOfBirth: idv.date_of_birth ?? null,
    gender: idv.gender ?? null,
    nationality: idv.nationality ?? null,
    issuingState: idv.issuing_state ?? null,
    dateOfIssue: idv.date_of_issue ?? null,
    expirationDate: idv.expiration_date ?? null,
    address: idv.formatted_address ?? idv.address ?? null,
    warnings,
    result: {
      document: stripDocument(idv),
      faceMatch: fm ? { status: fm.status, score: fm.score, warnings: fm.warnings ?? [] } : null,
    },
  };
}
