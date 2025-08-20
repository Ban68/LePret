import Image from 'next/image';

export function Logo() {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-lp-primary-1 p-1">
      <Image src="/placeholder-logo.png" alt="LePrêt Capital Logo" width={32} height={32} />
    </div>
  );
}