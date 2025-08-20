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
      <section className="py-20 bg-lp-sec-4">
        <HowItWorks />
      </section>
      <section className="py-20">
        <Benefits />
      </section>
      <section className="py-20 bg-lp-sec-4">
        <TrustMetrics />
      </section>
      <section className="py-20">
        <Allies />
      </section>
      <section className="py-20 bg-lp-sec-4">
        <Testimonials />
      </section>
      <section className="py-20">
        <Faq />
      </section>
    </>
  );
}