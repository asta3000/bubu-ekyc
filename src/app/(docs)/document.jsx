import { Suspense } from "react";
import { connection } from "next/server";
import { Markdown } from "@/components/Markdown";
import { Loading } from "@/components/Messages";
import { readDocument } from "@/lib/content";
import { formatDateTime } from "@/lib/format";

// Админы засварласан агуулгыг request бүрт уншина (хадгалмагц шууд харагдана)
const DocumentContent = async ({ docKey }) => {
  await connection();
  const { markdown, updatedAt } = await readDocument(docKey);
  return (
    <>
      <Markdown source={markdown} />
      {updatedAt && <p className="mt-8 text-xs text-gray-400">Сүүлд шинэчилсэн: {formatDateTime(updatedAt)}</p>}
    </>
  );
};

export const DocumentPage = ({ docKey }) => (
  <Suspense fallback={<Loading />}>
    <DocumentContent docKey={docKey} />
  </Suspense>
);
