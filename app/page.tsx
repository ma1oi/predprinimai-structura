import { FestivalHeader, HeroSection, CountdownSection, HistorySection } from "@/components/sections/hero-gallery";
import { AboutSection, PartnersSection } from "@/components/sections/about-partners";
import { ScheduleSection, SpeakersSection } from "@/components/sections/schedule-speakers";
import { RegistrationSection, FestivalFooter } from "@/components/sections/registration-footer";
import "./festival.css";
import { connection } from "next/server";
import { getPublishedSpeakers } from "@/lib/speaker-store";
import { getProgramSpeakers } from "@/lib/program-speaker-store";

export default async function Page() {
  await connection();
  const [speakers, programSpeakers] = await Promise.all([getPublishedSpeakers(), getProgramSpeakers()]);
  return (
    <div className="festival-page">
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
