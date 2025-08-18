const allies = [
  'Colombia Fintech',
  'ISO 27001 (en proceso)',
  'RADIAN-ready',
  'Superintendencia de Sociedades',
  'CCB',
];

export function Allies() {
  return (
    <section className="py-20 sm:py-24 bg-lp-primary-2">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center font-colette text-2xl font-semibold leading-8 text-lp-primary-1">
          Con la confianza y el respaldo de
        </h2>
        <div className="mx-auto mt-10 grid max-w-lg grid-cols-2 items-center gap-x-8 gap-y-10 sm:max-w-xl sm:grid-cols-3 lg:mx-0 lg:max-w-none">
          {allies.map((ally) => (
            <div key={ally} className="flex justify-center">
              <p className="text-lg text-lp-sec-3 font-semibold">{ally}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
