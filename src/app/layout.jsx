import "@/styles/globals.css";

export const metadata = {
  title: {
    default: "e-KYC — Харилцагчийг таньж мэдэх систем",
    template: "%s · e-KYC",
  },
  description:
    "Иргэний үнэмлэх, царай тулгалтаар харилцагчийг баталгаажуулж, НҮБ, ЕХ, OFAC, Их Британийн хоригийн жагсаалттай тулгах систем.",
  icons: { icon: "/logo.jpg", apple: "/logo.jpg" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="mn" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
