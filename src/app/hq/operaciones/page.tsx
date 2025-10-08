import { KycQueue } from "../ui/KycQueue";
import { RequestsBoard } from "../ui/RequestsBoard";

export default function HqOperationsPage() {
  return (
    <div className="space-y-8">
      <KycQueue />
      <RequestsBoard />
    </div>
  );
}
