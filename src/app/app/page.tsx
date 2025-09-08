export default function AppPage() {
  return (
    <div className="py-20 sm:py-24">
      <div className="container mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="font-colette text-3xl font-bold tracking-tight text-lp-primary-1 sm:text-4xl">
          Dashboard de Usuario
        </h1>
        <p className="mt-4 text-lg leading-8 text-lp-sec-3">
          Aquí podrás gestionar tus facturas, ver el estado de tus operaciones y acceder a tu historial.
        </p>
        <div className="mt-10">
          <div className="flex items-center justify-center gap-4">
            <a href="/app/operaciones" className="inline-flex rounded-md bg-lp-primary-1 px-5 py-2 text-sm font-medium text-white hover:bg-lp-primary-1/90">Ver mis operaciones</a>
            <a href="/app/operaciones/nueva" className="inline-flex rounded-md border px-5 py-2 text-sm font-medium hover:bg-accent">Nueva operación</a>
          </div>
        </div>
      </div>
    </div>
  );
}

