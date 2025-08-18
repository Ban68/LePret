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
      <HowItWorks />
      <Benefits />
      <TrustMetrics />
      <Allies />
      <Testimonials />
      <Faq />
    </>
  );
}