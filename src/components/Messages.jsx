import { PageTitle } from "./Titles";

export const Message = ({ error, success }) => {
  if (error) return <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p>;
  if (success) return <p className="rounded-md bg-green-50 p-2 text-sm text-green-700">{success}</p>;
  return null;
};

// Хуудсанд хандах эрхгүй үед: гарчиг (өгвөл) ба алдааны мессеж
export const AccessDenied = ({ title, description, error }) => (
  <>
    {title && <PageTitle title={title} description={description} />}
    <Message error={error} />
  </>
);

export const Loading = ({ className = "" }) => (
  <p className={`text-sm text-gray-500 ${className}`}>Ачаалж байна...</p>
);

// loading.jsx-ийн нийтлэг fallback
export const PageLoading = () => <Loading className="py-4" />;

// Жагсаалт хоосон эсвэл ачаалж байх үеийн хүрээ
export const EmptyState = ({ children }) => (
  <p className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
    {children}
  </p>
);
