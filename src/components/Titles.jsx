// aside: гарчгийн баруун талд (жижиг дэлгэцэд доор нь) харуулах хэсэг, жишээ нь багцын үлдэгдэл
export const PageTitle = ({ title, description, aside = null }) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div className="min-w-0 space-y-1">
      <h1 className="text-xl font-semibold">{title}</h1>
      {description && <p className="text-sm text-gray-500">{description}</p>}
    </div>
    {aside && <div className="shrink-0 sm:max-w-xs">{aside}</div>}
  </div>
);

export const SectionTitle = ({ children }) => (
  <h3 className="text-sm font-semibold text-gray-900">{children}</h3>
);
