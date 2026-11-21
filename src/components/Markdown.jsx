// src/content/*.md баримтуудыг харуулах энгийн markdown renderer. Зөвхөн эдгээр баримтад
// хэрэглэгддэг хэлбэрийг дэмжинэ: гарчиг (#, ##, ###), догол мөр, жагсаалт (-, 1.),
// хүснэгт, ишлэл (>), **тод**. HTML-ийг React өөрөө escape хийнэ.

const inline = (text) =>
  text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={index} className="font-semibold text-gray-900">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );

const cells = (line) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());

const slug = (text) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");

// Мөрүүдийг блок болгон задлана
function parse(markdown) {
  const lines = markdown.split("\n");
  const blocks = [];
  let index = 0;
  const take = (test) => {
    const rows = [];
    while (index < lines.length && test(lines[index])) rows.push(lines[index++]);
    return rows;
  };

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index++;
    } else if (/^#{1,3} /.test(line)) {
      const level = line.match(/^#+/)[0].length;
      blocks.push({ type: "heading", level, text: line.slice(level + 1).trim() });
      index++;
    } else if (line.startsWith("|")) {
      const rows = take((row) => row.startsWith("|"));
      const align = cells(rows[1] ?? "").map((cell) => (cell.startsWith(":") && cell.endsWith(":") ? "center" : "left"));
      blocks.push({ type: "table", head: cells(rows[0]), align, rows: rows.slice(2).map(cells) });
    } else if (line.startsWith(">")) {
      const rows = take((row) => row.startsWith(">"));
      blocks.push({ type: "quote", text: rows.map((row) => row.replace(/^>\s?/, "")).join(" ") });
    } else if (/^- /.test(line)) {
      blocks.push({ type: "ul", items: take((row) => /^- /.test(row)).map((row) => row.slice(2)) });
    } else if (/^\d+\. /.test(line)) {
      blocks.push({ type: "ol", items: take((row) => /^\d+\. /.test(row)).map((row) => row.replace(/^\d+\. /, "")) });
    } else {
      const rows = take((row) => row.trim() && !/^(#{1,3} |\||>|- |\d+\. )/.test(row));
      blocks.push({ type: "p", text: rows.join(" ") });
    }
  }
  return blocks;
}

const HEADINGS = {
  1: "text-2xl font-bold tracking-tight text-gray-900",
  2: "scroll-mt-20 border-b border-gray-200 pt-4 pb-2 text-lg font-semibold text-gray-900",
  3: "pt-2 text-base font-semibold text-gray-900",
};

const Block = ({ block }) => {
  switch (block.type) {
    case "heading": {
      const Tag = `h${block.level}`;
      return (
        <Tag id={slug(block.text)} className={HEADINGS[block.level]}>
          {inline(block.text)}
        </Tag>
      );
    }
    case "table":
      return (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-700">
              <tr>
                {block.head.map((cell, index) => (
                  <th key={index} className="px-3 py-2 font-semibold" style={{ textAlign: block.align[index] }}>
                    {inline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, index) => (
                    <td key={index} className="px-3 py-2 align-top" style={{ textAlign: block.align[index] }}>
                      {inline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "quote":
      return <p className="rounded-md bg-blue-50 px-4 py-3 text-blue-900">{inline(block.text)}</p>;
    case "ul":
      return (
        <ul className="list-disc space-y-1 pl-6">
          {block.items.map((item, index) => (
            <li key={index}>{inline(item)}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="list-decimal space-y-1 pl-6">
          {block.items.map((item, index) => (
            <li key={index}>{inline(item)}</li>
          ))}
        </ol>
      );
    default:
      return <p>{inline(block.text)}</p>;
  }
};

export const Markdown = ({ source, className = "" }) => (
  <div className={`space-y-3 text-sm leading-relaxed text-gray-700 ${className}`}>
    {parse(source).map((block, index) => (
      <Block key={index} block={block} />
    ))}
  </div>
);
