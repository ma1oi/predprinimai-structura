import type { Metadata } from "next";
import { SpeakersAdmin } from "./speakers-admin";

export const metadata: Metadata = {
  title: "Управление сайтом — Предпринимай",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <SpeakersAdmin />;
}
