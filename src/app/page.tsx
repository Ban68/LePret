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
      <HowItWorks backgroundClass="bg-lp-sec-4" />
      <Benefits backgroundClass="bg-lp-sec-4" />
      <TrustMetrics backgroundClass="bg-lp-primary-2" />
      <Allies backgroundClass="bg-lp-primary-2" />
      <Testimonials backgroundClass="bg-lp-sec-2" />
      <Faq backgroundClass="bg-lp-primary-2" />
    </>
  );
}