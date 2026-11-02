import Link from "next/link";
import { Badge } from "@/components/Badges";
import { Card } from "@/components/Cards";
import { Cell, Table } from "@/components/Tables";
import { scoreLevel } from "./labels";

// Файлаар олноор тулгасны үр дүн: тулгасан мөрүүд (тохиролтой нь эхэндээ) ба алдаатай мөрүүд.
// results: [{ row, name, screeningId, matchCount, topScore }], errors: [{ row, name, message }]
export const BatchResults = ({ results, errors }) => {
  const matched = results.filter((item) => item.matchCount > 0).length;
  const sorted = [...results].sort((a, b) => b.topScore - a.topScore || a.row - b.row);

  return (
    <Card
      title="Файлын тулгалтын үр дүн"
      description={`${results.length} мөр тулгасан · ${matched} мөрт тохирол илэрсэн${errors.length ? ` · ${errors.length} мөр алдаатай` : ""}. Дэлгэрэнгүйг нэр дээр дарж харна, хэвлэнэ.`}
    >
      <div className="space-y-4">
        {sorted.length > 0 && (
          <Table headers={["Мөр", "Нэр", "Тохирол", "Дээд оноо"]}>
            {sorted.map((item) => (
              <tr key={item.screeningId} className="hover:bg-gray-50">
                <Cell className="text-gray-500 tabular-nums">{item.row}</Cell>
                <Cell>
                  <Link
                    href={`/organizations/match/${item.screeningId}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {item.name}
                  </Link>
                </Cell>
                <Cell>{item.matchCount}</Cell>
                <Cell>
                  {item.matchCount ? (
                    <Badge tone={scoreLevel(item.topScore).tone} solid>
                      {item.topScore}
                    </Badge>
                  ) : (
                    <span className="text-xs text-green-700">Цэвэр</span>
                  )}
                </Cell>
              </tr>
            ))}
          </Table>
        )}
        {errors.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-red-700">Тулгаагүй мөрүүд</h3>
            <Table headers={["Мөр", "Нэр", "Шалтгаан"]}>
              {errors.map((item) => (
                <tr key={`${item.row}-${item.message}`}>
                  <Cell className="text-gray-500 tabular-nums">{item.row}</Cell>
                  <Cell>{item.name || "—"}</Cell>
                  <Cell className="text-red-700">{item.message}</Cell>
                </tr>
              ))}
            </Table>
          </div>
        )}
      </div>
    </Card>
  );
};
