import OperationCreateForm from "@/components/forms/OperationCreateForm";

export default function NuevaOperacionPage() {
  return (
    <div className="py-10">
      <div className="container mx-auto max-w-2xl px-4">
        <h2 className="text-xl font-semibold">Nueva operación</h2>
        <p className="mt-1 text-sm text-muted-foreground">Solicita una nueva operación de factoring.</p>
        <div className="mt-6">
          <OperationCreateForm />
        </div>
      </div>
    </div>
  );
}

