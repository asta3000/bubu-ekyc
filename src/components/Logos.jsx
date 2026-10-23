import Link from "next/link";

// Брэнд нэр. Дарахад вэбсайтын нүүр (нэвтэрсэн бол proxy өөрийн хуудас руу шилжүүлнэ).
export const Logo = ({ href = "/", className = "text-lg" }) => (
  <Link href={href} className={`font-bold tracking-tight text-gray-900 ${className}`}>
    e-<span className="text-blue-600">KYC</span>
  </Link>
);
