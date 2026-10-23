"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/managements/operations", label: "Үйл ажиллагаа" },
  { href: "/managements/organizations", label: "Байгууллага" },
  { href: "/managements/users", label: "Хэрэглэгч" },
  { href: "/managements/sanctions", label: "Хоригийн жагсаалт" },
  { href: "/managements/packages", label: "Багц" },
  { href: "/managements/payments", label: "Төлбөр" },
  { href: "/managements/coupons", label: "Купон" },
  { href: "/managements/settings", label: "Тохиргоо" },
];

const ManagementTabs = () => {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b border-gray-200">
      {TABS.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              active
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
};

export default ManagementTabs;
