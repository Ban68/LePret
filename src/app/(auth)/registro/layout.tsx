export default function RegistroLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-lp-primary-2/10 py-12 sm:py-16">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-lp-sec-4/40 bg-white/80 p-6 shadow-lg backdrop-blur">
          {children}
        </div>
      </div>
    </div>
  );
}
