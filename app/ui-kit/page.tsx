import { KitShowcase } from "@/components/kit-showcase";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Предпринимай — UI-кит",
  robots: { index: false, follow: false },
};

export default function UiKitPage() {
  return <KitShowcase />;
}
