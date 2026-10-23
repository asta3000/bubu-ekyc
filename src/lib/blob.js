import { del, get, put } from "@vercel/blob";

// Vercel Blob storage (private store). BLOB_READ_WRITE_TOKEN-ийг .env-ээс автоматаар уншина.
// Private файлыг браузер шууд нээж чадахгүй тул app-ийн API-аар дамжуулж өгнө.

const EXTENSIONS = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

// Байгууллагын логог хадгалж blob-ийн URL-ийг буцаана (DB-д хадгална, client-д өгөхгүй)
export async function uploadLogo(file) {
  const blob = await put(`organizations/logo.${EXTENSIONS[file.type]}`, file, {
    access: "private",
    addRandomSuffix: true,
    contentType: file.type,
  });
  return blob.url;
}

// Файлыг уншина. Олдоогүй бол null, ifNoneMatch таарвал statusCode 304.
export const readBlob = (url, ifNoneMatch) =>
  get(url, { access: "private", ifNoneMatch: ifNoneMatch ?? undefined });

// Хуучин файлыг устгана. Устгаж чадаагүй нь үндсэн үйлдлийг таслахгүй.
export async function deleteBlob(url) {
  if (!url) return;
  try {
    await del(url);
  } catch (error) {
    console.error(`[blob] ${url}:`, error.message);
  }
}

// Client-д харуулах логоны хаяг. updatedAt-аар хувилбар өгч, лого солигдоход кэш шинэчлэгдэнэ.
export const organizationLogoSrc = (organization) =>
  organization.logo
    ? `/api/organizations/${organization.id}/logo?v=${organization.updatedAt.getTime()}`
    : null;
