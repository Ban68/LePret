"use client";

export default function Error({ error }: { error: Error }) {
  return (
    <div className="p-10 text-center">
      <h1 className="mb-2 text-2xl font-bold text-lp-primary-1">Ocurrió un error</h1>
      <p className="text-sm text-red-600">{error.message}</p>
    </div>
  );
}

