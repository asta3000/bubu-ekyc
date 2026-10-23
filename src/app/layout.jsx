import "@/styles/globals.css";

export const metadata = {
  title: "e-KYC",
  description: "E_KYC",
};

export default function RootLayout({ children }) {
  return (
    <html lang="mn" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
