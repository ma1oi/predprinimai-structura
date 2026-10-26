import { FestivalHeader, HeroSection, CountdownSection, HistorySection } from "@/components/sections/hero-gallery";
import { AboutSection, PartnersSection } from "@/components/sections/about-partners";
import { ScheduleSection, SpeakersSection } from "@/components/sections/schedule-speakers";
import { RegistrationSection, FestivalFooter } from "@/components/sections/registration-footer";
import "./festival.css";
import { connection } from "next/server";
import { getPublishedSpeakers } from "@/lib/speaker-store";
import { getProgramSpeakers } from "@/lib/program-speaker-store";
import type { Metadata } from "next";
import { festivalStructuredData, site } from "@/lib/site-metadata";

export const metadata: Metadata = {
  title: site.title,
  description: site.description,
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: site.name,
    url: "/",
    title: site.title,
    description: site.description,
    images: [{ url: site.image, width: 1200, height: 630, alt: site.imageAlt }],
  },
  twitter: {
    card: "summary_large_image",
    title: site.title,
    description: site.description,
    images: [{ url: site.image, alt: site.imageAlt }],
  },
};

export default async function Page() {
  await connection();
  const [speakers, programSpeakers] = await Promise.all([getPublishedSpeakers(), getProgramSpeakers()]);
  return (
    <div className="festival-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(festivalStructuredData).replace(/</g, "\\u003c") }} />
      <FestivalHeader />
      <main>
      <HeroSection />
      <CountdownSection />
      <HistorySection />
      <div className="festival-about"><AboutSection /></div>
      <div className="festival-partners"><PartnersSection /></div>
      <div className="festival-schedule"><ScheduleSection initialProgramSpeakers={programSpeakers} /></div>
      <SpeakersSection initialSpeakers={speakers} />
      <div className="festival-registration"><RegistrationSection /></div>
      </main>
      <FestivalFooter />
    </div>
  );
}
