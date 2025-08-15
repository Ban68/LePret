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
          <p className="text-base text-lp-sec-3">
            (Esta es una maqueta de UI. La funcionalidad de autenticación y gestión de facturas se implementará en fases posteriores.)
          </p>
        </div>
      </div>
    </div>
  );
}
