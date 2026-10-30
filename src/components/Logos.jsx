import Image from "next/image";
import Link from "next/link";

// Брэндийн тэмдэг (public/logo.jpg). Цагаан дэвсгэртэй зураг тул цайвар дэвсгэр дээр ашиглана.
export const LogoMark = ({ className = "h-7 w-7", ...props }) => (
  <Image
    src="/logo.jpg"
    alt=""
    width={1280}
    height={1280}
    className={`shrink-0 mix-blend-multiply ${className}`}
    {...props}
  />
);

// Брэнд нэр. Дарахад вэбсайтын нүүр.
export const Logo = ({ href = "/", className = "text-lg" }) => (
  <Link href={href} className={`flex items-center gap-2 font-bold tracking-tight text-gray-900 ${className}`}>
    <LogoMark className="h-[1.6em] w-[1.6em]" loading="eager" />
    <span>
      e-<span className="text-teal-600">KYC</span>
    </span>
  </Link>
);
