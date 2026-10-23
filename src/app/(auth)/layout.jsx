import { Card } from "@/components/Cards";
import { TextLink } from "@/components/Links";
import { Logo } from "@/components/Logos";

export const metadata = {
  title: "Нэвтрэх",
};

// <html>, <body> нь app/layout.jsx-д байгаа тул энд зөвхөн голлуулсан карт.
// Лого болон доорх холбоос вэбсайтын нүүр рүү буцаана.
const AuthLayout = ({ children }) => {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-gray-50 px-4 py-10">
      <Logo className="text-2xl" />
      <Card as="main" className="w-full max-w-sm">
        {children}
      </Card>
      <TextLink href="/">
        ← Вэбсайт руу буцах
      </TextLink>
    </div>
  );
};

export default AuthLayout;
