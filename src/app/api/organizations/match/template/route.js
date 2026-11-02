import { requireOrganizationApi } from "@/lib/organization-access";
import { XLSX_TYPE, buildTemplate } from "@/lib/screening/batch";

// Олноор тулгах xlsx загвар
export async function GET() {
  const { error } = await requireOrganizationApi();
  if (error) return error;

  return new Response(await buildTemplate(), {
    headers: {
      "Content-Type": XLSX_TYPE,
      "Content-Disposition": `attachment; filename="screening-template.xlsx"`,
    },
  });
}
