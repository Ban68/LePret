import Image from 'next/image';

export function Logo() {
  return (
    <div className="flex h-10 w-10 items-center justify-center">
      <Image
        src="/LPsinFondo.png"
        alt="Monograma LP de LePrêt Capital"
        width={32}
        height={32}
        className="h-8 w-8 object-contain"
        priority
      />
    </div>
  );
}
