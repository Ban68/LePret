import { Hero } from '@/components/landing/Hero';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Benefits } from '@/components/landing/Benefits';
import { TrustMetrics } from '@/components/landing/TrustMetrics';
import { Allies } from '@/components/landing/Allies';
import { Testimonials } from '@/components/landing/Testimonials';
import { Faq } from '@/components/landing/Faq';

export default function Home() {
  return (
    <>
      <Hero />
      <section className="py-20 sm:py-32 bg-lp-sec-2">
        <HowItWorks />
      </section>
      <section className="py-20 sm:py-32 bg-lp-sec-4">
        <Benefits />
      </section>
      <section className="py-20 sm:py-32 bg-lp-primary-2">
        <TrustMetrics />
      </section>
      <section className="py-20 sm:py-24 bg-lp-sec-1">
        <Allies />
      </section>
      <section className="py-20 sm:py-32 bg-lp-sec-3">
        <Testimonials />
      </section>
      <section className="py-20 sm:py-32 bg-white">
        <Faq />
      </section>
    </>
  );
}