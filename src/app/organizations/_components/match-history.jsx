import Link from "next/link";
import { Badge } from "@/components/Badges";
import { EmptyState } from "@/components/Messages";
import { formatDateTime, personName } from "@/lib/format";
import { Cell, Table } from "@/components/Tables";
import { SUBJECT_LABELS, scoreLevel } from "./labels";

// Тулгалтын түүх. showOrganization: админд байгууллагын баганыг харуулна.
const MatchHistory = ({ screenings, showOrganization }) => {
  if (screenings.length === 0) return <EmptyState>Тулгалт хийгдээгүй байна</EmptyState>;

  const headers = ["Огноо", "Нэр", "Төрөл", "Шалгасан", ...(showOrganization ? ["Байгууллага"] : []), "Тохирол", "Дээд оноо"];
  return (
    <Table headers={headers}>
      {screenings.map((screening) => (
        <tr key={screening.id} className="hover:bg-gray-50">
          <Cell className="whitespace-nowrap text-gray-600">{formatDateTime(screening.createdAt)}</Cell>
          <Cell>
            <Link href={`/organizations/match/${screening.id}`} className="font-medium text-blue-600 hover:underline">
              {screening.name}
            </Link>
          </Cell>
          <Cell className="text-gray-600">{SUBJECT_LABELS[screening.subjectType] ?? "Бүгд"}</Cell>
          <Cell className="whitespace-nowrap text-gray-600">
            {personName(screening.user)}
          </Cell>
          {showOrganization && <Cell className="text-gray-600">{screening.organization?.name ?? "—"}</Cell>}
          <Cell>{screening.matchCount}</Cell>
          <Cell>
            {screening.matchCount ? (
              <Badge tone={scoreLevel(screening.topScore).tone} solid>
                {screening.topScore}
              </Badge>
            ) : (
              <span className="text-xs text-green-700">Цэвэр</span>
            )}
          </Cell>
        </tr>
      ))}
    </Table>
  );
};

export default MatchHistory;
