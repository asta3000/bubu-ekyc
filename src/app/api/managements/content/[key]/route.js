import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { notFound, parseBody } from "@/lib/api";
import { requireAdminApi } from "@/lib/session";
import { DOCUMENTS, newVersion, readDocument } from "@/lib/content";
import { logAudit } from "@/lib/audit/log";

const schema = z.object({
  markdown: z.string().trim().min(1, { error: "Агуулга хоосон байж болохгүй" }).max(200000, { error: "Агуулга хэт урт байна" }),
  // Үйлчилгээний нөхцөл, нууцлалын бодлогод: true бол шинэ хувилбар болж хэрэглэгчээс дахин зөвшөөрөл авна
  newVersion: z.boolean().optional(),
});

// Баримтын агуулгыг хадгална (системийн админ). Хадгалмагц нийтийн хуудсанд шууд харагдана.
export async function PUT(request, ctx) {
  const { error, session } = await requireAdminApi();
  if (error) return error;

  const { key } = await ctx.params;
  const document = DOCUMENTS[key];
  if (!document) return notFound("Баримт олдсонгүй");

  const { data, error: invalid } = await parseBody(request, schema);
  if (invalid) return invalid;

  const current = await readDocument(key);
  const bump = document.versioned && data.newVersion;
  const version = bump ? newVersion() : current.version;

  await prisma.contentDocument.upsert({
    where: { key },
    create: { key, markdown: data.markdown, version, updatedById: session.user.id },
    update: { markdown: data.markdown, version, updatedById: session.user.id },
  });
  await logAudit({
    action: "settings.content",
    actor: session.user,
    organizationId: null,
    summary: `"${document.title}"-ийг засав${bump ? ` (шинэ хувилбар ${version}, хэрэглэгчээс дахин зөвшөөрөл авна)` : ""}`,
    metadata: { key, version, previousVersion: current.version },
  });
  return Response.json({
    message: bump ? `Хадгалагдлаа. Шинэ хувилбар: ${version}. Хэрэглэгчид дахин зөвшөөрнө.` : "Хадгалагдлаа",
  });
}
