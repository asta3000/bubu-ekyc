// Цагаан хүрээтэй хэсэг. title өгвөл дээд талд гарчиг, тайлбартай. Бусад props (id г.м.) tag-д.
export const Card = ({ as: Tag = "section", title, description, className = "", children, ...props }) => (
  <Tag className={`space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm ${className}`} {...props}>
    {title && (
      <div className="space-y-1">
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="text-sm text-gray-500">{description}</p>}
      </div>
    )}
    {children}
  </Tag>
);
