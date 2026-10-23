export const PageTitle = ({ title, description }) => (
  <div className="space-y-1">
    <h1 className="text-xl font-semibold">{title}</h1>
    {description && <p className="text-sm text-gray-500">{description}</p>}
  </div>
);

export const SectionTitle = ({ children }) => (
  <h3 className="text-sm font-semibold text-gray-900">{children}</h3>
);
