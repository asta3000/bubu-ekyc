import { Markdown } from "@/components/Markdown";
import { readDocument } from "@/lib/content";

export const metadata = { title: "Гарын авлага" };

const Page = async () => {
  const { markdown } = await readDocument("guide");
  return <Markdown source={markdown} />;
};

export default Page;
