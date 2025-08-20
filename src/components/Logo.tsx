import Image from 'next/image';

export function Logo() {
  return (
    <div className="flex h-8 w-8 items-center justify-center">
      <Image src="/LPsinFondo.png" alt="LePrêt Capital Logo" width={32} height={32} />
    </div>
  );
}
