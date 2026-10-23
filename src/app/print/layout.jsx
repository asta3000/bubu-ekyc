// Хэвлэх хуудсууд: navbar-гүй, цагаан дэвсгэр дээр A4 хэмжээтэй
export const metadata = { title: "Хэвлэх" };

const PrintLayout = ({ children }) => <div className="flex flex-1 flex-col bg-gray-100 print:bg-white">{children}</div>;

export default PrintLayout;
