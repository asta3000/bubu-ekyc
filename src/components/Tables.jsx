// Энгийн хүснэгт. headers: баганын гарчгууд, children: <tr> мөрүүд
export const Table = ({ headers, children }) => (
  <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
    <table className="min-w-full divide-y divide-gray-200 text-sm">
      <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500">
        <tr>
          {headers.map((header, index) => (
            <th key={index} className="whitespace-nowrap px-4 py-2">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">{children}</tbody>
    </table>
  </div>
);

export const Cell = ({ className = "", ...props }) => (
  <td className={`px-4 py-2 align-middle ${className}`} {...props} />
);
