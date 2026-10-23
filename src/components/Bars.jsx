"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/actions";
import { ROLE_LABELS } from "@/lib/labels";
import { Badge } from "./Badges";
import { Logo } from "./Logos";


const initials = (user) =>
  `${user.lastName?.[0] ?? ""}${user.firstName?.[0] ?? ""}`.toUpperCase() || "?";

const Avatar = ({ user, className = "h-9 w-9 text-sm" }) => (
  <span
    className={`flex shrink-0 items-center justify-center rounded-full bg-blue-600 font-semibold text-white ${className}`}
  >
    {initials(user)}
  </span>
);

const MenuLink = ({ href, children, onClick }) => (
  <Link
    href={href}
    onClick={onClick}
    role="menuitem"
    className="block rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
  >
    {children}
  </Link>
);

// Хэрэглэгчийн цэс: аватар дээр дарахад мэдээлэл, профайл, гарах
const UserMenu = ({ user }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = () => setOpen(false);

  // Гадна дарах эсвэл Escape дарахад хаана
  useEffect(() => {
    if (!open) return;
    const onClick = (event) => {
      if (!ref.current?.contains(event.target)) close();
    };
    const onKey = (event) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-3 rounded-lg px-2 py-1 hover:bg-gray-100"
      >
        <span className="hidden text-right sm:block">
          <span className="block text-sm font-medium text-gray-900">{user.name}</span>
          <span className="block text-xs text-gray-500">
            {user.organizationName ?? ROLE_LABELS[user.role]}
          </span>
        </span>
        <Avatar user={user} />
        <svg
          viewBox="0 0 20 20"
          className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path fill="currentColor" d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-gray-200 bg-white p-2 shadow-lg"
        >
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar user={user} className="h-10 w-10" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">{user.name}</p>
              <p className="truncate text-xs text-gray-500">{user.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 px-3 pb-2">
            <Badge tone="blue">{ROLE_LABELS[user.role]}</Badge>
            {user.organizationName && (
              <Badge>{user.organizationName}</Badge>
            )}
          </div>
          <div className="my-1 h-px bg-gray-100" />
          <MenuLink href="/profile" onClick={close}>
            Миний мэдээлэл
          </MenuLink>
          {user.role === "ADMIN" && (
            <MenuLink href="/managements" onClick={close}>
              Удирдлага
            </MenuLink>
          )}
          <div className="my-1 h-px bg-gray-100" />
          <form action={logout}>
            <button
              type="submit"
              role="menuitem"
              className="block w-full rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              Гарах
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

const NavLink = ({ href, children }) => {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={`text-sm font-medium ${active ? "text-blue-600" : "text-gray-600 hover:text-gray-900"}`}
    >
      {children}
    </Link>
  );
};

// Дээд талын цэс: лого, хэсгүүдийн холбоос, хэрэглэгчийн цэс
export const Navbar = ({ user }) => (
  <header className="border-b border-gray-200 bg-white">
    <nav className="flex w-full items-center justify-between gap-4 px-4 py-2">
      <div className="flex items-center gap-6">
        <Logo />
        <NavLink href="/organizations/verifications">Баталгаажуулалт</NavLink>
        <NavLink href="/organizations/match">Хориг тулгах</NavLink>
        <NavLink href="/organizations/billing">Багц, төлбөр</NavLink>
        {user.role === "ADMIN" && <NavLink href="/managements">Удирдлага</NavLink>}
      </div>
      <UserMenu user={user} />
    </nav>
  </header>
);
