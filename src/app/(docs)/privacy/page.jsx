import { Markdown } from "@/components/Markdown";
import { readDocument } from "@/lib/content";

export const metadata = { title: "Нууцлал ба аюулгүй байдал" };

const Page = async () => {
  const { markdown } = await readDocument("privacy");
  return <Markdown source={markdown} />;
};

export default Page;
