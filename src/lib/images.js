// Браузерт зургийг багасгана. Vercel function-ий хүсэлт 4.5MB-аас их байж болохгүй,
// Didit ч зургийг ~0.5MB болгож шахдаг тул чанар алдагдахгүй.
const MAX_SIDE = 2000;
const QUALITY = 0.9;

export async function compressImage(file) {
  if (!file.type.startsWith("image/")) return file;
  try {
    // EXIF-ийн эргүүлэлтийг хэрэгжүүлж уншина
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
