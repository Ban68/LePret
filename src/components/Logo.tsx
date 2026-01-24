import Image from 'next/image';

export function Logo() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-lp-primary-2 shadow-sm">
      <Image
        src="/LPsinFondo.png"
        alt="Monograma LP de LePrêt Capital"
        width={32}
        height={32}
        className="h-7 w-7 object-contain invert"
        priority
      />
    </div>
  );
}
