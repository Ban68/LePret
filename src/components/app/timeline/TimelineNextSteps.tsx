import { StatusBadge } from "@/components/ui/status-badge";

export type NextSteps = {
  label: string;
  hint?: string | null;
} | null;

type Props = {
  status: string | null;
  nextSteps: NextSteps;
};

export function TimelineNextSteps({ status, nextSteps }: Props) {
  if (!nextSteps) return null;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-neutral-900">Próximo paso</p>
          <p className="text-base font-medium text-lp-primary-1">{nextSteps.label}</p>
          {nextSteps.hint ? <p className="text-sm text-neutral-500">{nextSteps.hint}</p> : null}
        </div>
        <StatusBadge status={status} kind="request" />
      </div>
    </div>
  );
}

