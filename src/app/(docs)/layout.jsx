import Link from "next/link";
import { Logo } from "@/components/Logos";

// Нэвтрээгүй хүн ч харах баримтын хуудсууд (үйлчилгээний нөхцөл, нууцлалын бодлого, гарын авлага)
const LINKS = [
  { href: "/terms", label: "Үйлчилгээний нөхцөл" },
  { href: "/privacy", label: "Нууцлал ба аюулгүй байдал" },
  { href: "/guide", label: "Гарын авлага" },
];

const DocsLayout = ({ children }) => (
  <div className="flex flex-1 flex-col bg-gray-50">
    <header className="border-b border-gray-200 bg-white">
      <nav className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Logo />
        <div className="flex items-center gap-4 text-sm">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="font-medium text-gray-600 hover:text-gray-900">
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <article className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-10">{children}</article>
    </main>
  </div>
);

export default DocsLayout;
