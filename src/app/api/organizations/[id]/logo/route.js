import { prisma } from "@/lib/prisma";
import { notDeleted, notFound } from "@/lib/api";
import { readBlob } from "@/lib/blob";
import { requireSessionApi } from "@/lib/session";

// Байгууллагын логог private blob storage-оос дамжуулна. Нэвтэрсэн хэрэглэгч бүрт нээлттэй.
// URL нь ?v=<updatedAt> хувилбартай тул браузер удаан кэшлэнэ.
export async function GET(request, ctx) {
  const { error } = await requireSessionApi();
  if (error) return error;

  const { id } = await ctx.params;
  const organization = await prisma.organization.findFirst({
    where: { id, ...notDeleted },
    select: { logo: true },
  });
  if (!organization?.logo) return notFound("Лого олдсонгүй");

  const result = await readBlob(organization.logo, request.headers.get("if-none-match"));
  if (!result) return notFound("Лого олдсонгүй");

  const headers = {
    "Cache-Control": "private, max-age=31536000, immutable",
    ETag: result.blob.etag,
    "X-Content-Type-Options": "nosniff",
  };
  if (result.statusCode === 304) return new Response(null, { status: 304, headers });

  return new Response(result.stream, {
    headers: { ...headers, "Content-Type": result.blob.contentType },
  });
}
