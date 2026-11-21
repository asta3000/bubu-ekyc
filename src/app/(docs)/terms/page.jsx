import { Markdown } from "@/components/Markdown";
import { readDocument } from "@/lib/content";

export const metadata = { title: "Үйлчилгээний нөхцөл" };

const Page = async () => {
  const { markdown } = await readDocument("terms");
  return <Markdown source={markdown} />;
};

export default Page;
