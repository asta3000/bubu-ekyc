import { fieldErrors } from "@/lib/validations";

// JSON body-г schema-аар шалгана: { data } эсвэл 400 алдааны { error } Response
export async function parseBody(request, schema) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { error: Response.json({ errors: fieldErrors(parsed.error) }, { status: 400 }) };
  }
  return { data: parsed.data };
}

export const notFound = (message = "Олдсонгүй") => Response.json({ error: message }, { status: 404 });

// Формын нэг талбарын алдаа
export const fieldError = (field, message, status = 400) =>
  Response.json({ errors: { [field]: message } }, { status });

// Prisma-ийн мэдэгдэж буй алдааг хариу болгоно, бусдыг дахин шиднэ.
// P2025: бичлэг олдсонгүй, P2002: unique талбар давхардсан.
export function prismaErrorResponse(error, { notFound: notFoundMessage, unique } = {}) {
  if (error?.code === "P2025") return notFound(notFoundMessage);
  if (error?.code === "P2002" && unique) return fieldError(unique.field, unique.message, 409);
  throw error;
}

// Устгагдаагүй бичлэг (soft delete-тэй модельд)
export const notDeleted = { status: { not: "DELETED" } };
