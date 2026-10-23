// Мэдээллийн талбар (<dl> дотор). Утга хоосон бол "—".

// Шошго дээр, утга доор
export const Field = ({ label, value }) => (
  <div>
    <dt className="text-xs text-gray-500">{label}</dt>
    <dd className="text-sm text-gray-900">{value || "—"}</dd>
  </div>
);

// Шошго зүүн, утга баруун талд нэг мөрөнд. strong: утгыг тодруулна
export const InlineField = ({ label, value, strong = false, className = "" }) => (
  <div className={`flex justify-between gap-4 ${className}`}>
    <dt className="text-gray-500">{label}</dt>
    <dd className={`text-right text-gray-900 ${strong ? "font-medium" : ""}`}>{value || "—"}</dd>
  </div>
);
