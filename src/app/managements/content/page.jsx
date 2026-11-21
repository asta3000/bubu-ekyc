import { DOCUMENTS, DOCUMENT_KEYS, readDocument } from "@/lib/content";
import { requireAdminPage } from "@/lib/session";
import { ReportTabs } from "@/components/Reports";
import { PageTitle } from "@/components/Titles";
import ContentEditor from "./content-editor";

export const metadata = { title: "Баримт бичиг" };

const TABS = DOCUMENT_KEYS.map((key) => ({ key, label: DOCUMENTS[key].title }));

// Үйлчилгээний нөхцөл, нууцлалын бодлого, гарын авлагыг засах: ?doc=terms | privacy | guide
const ContentPage = async ({ searchParams }) => {
  await requireAdminPage();
  const { doc } = await searchParams;
  const key = DOCUMENTS[doc] ? doc : DOCUMENT_KEYS[0];
  const document = await readDocument(key);

  return (
    <div className="space-y-4">
      <PageTitle
        title="Баримт бичиг"
        description="Хэрэглэгчдэд харагдах үйлчилгээний нөхцөл, нууцлалын бодлого, гарын авлагыг засна. Хадгалмагц шууд шинэчлэгдэнэ."
      />
      <ReportTabs tabs={TABS} active={key} param="doc" />
      <ContentEditor
        key={key}
        docKey={key}
        title={DOCUMENTS[key].title}
        path={DOCUMENTS[key].path}
        versioned={DOCUMENTS[key].versioned}
        markdown={document.markdown}
        version={document.version}
        updatedAt={document.updatedAt?.toISOString() ?? null}
      />
    </div>
  );
};

export default ContentPage;
