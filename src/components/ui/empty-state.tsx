import { Button } from "@/components/ui/button";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-lp-sec-4/60 p-12 text-center">
      <h3 className="text-lg font-semibold text-lp-primary-1">{title}</h3>
      <p className="mt-2 text-sm text-lp-sec-3">{description}</p>
      {action && (
        <Button onClick={action.onClick} className="mt-4">
          {action.label}
        </Button>
      )}
    </div>
  );
}
