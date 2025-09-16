import { Hero } from '@/components/landing/Hero';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Benefits } from '@/components/landing/Benefits';
import { TrustMetrics } from '@/components/landing/TrustMetrics';
import { Testimonials } from '@/components/landing/Testimonials';
import { Faq } from '@/components/landing/Faq';

export default function Home() {
  return (
    <>
      <Hero />
      <HowItWorks backgroundClass="bg-lp-sec-4" />
      <Benefits backgroundClass="bg-lp-sec-4" />
      <TrustMetrics backgroundClass="bg-lp-primary-2" />
      <Testimonials />
      <Faq backgroundClass="bg-lp-primary-2" />
    </>
  );
}