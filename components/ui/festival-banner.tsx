import Image from "next/image";
import type { ReactNode } from "react";

export function FestivalBanner({ children = "фестиваль сегодня" }: { children?: ReactNode }) {
  return (
    <div className="kit-festival-banner relative flex items-center justify-center">
      <Image src="/assets/figma/star-left.webp" width={235} height={190} alt="" className="kit-star kit-star-left" />
      <span>{children}</span>
      <Image src="/assets/figma/star-right.webp" width={235} height={190} alt="" className="kit-star kit-star-right" />
    </div>
  );
}
