import Image from "next/image";

/** Both source crops are exported from Figma; mobile never re-crops the desktop image. */
export function HeroImage({ variant = "responsive" }: { variant?: "desktop" | "mobile" | "responsive" }) {
  if (variant === "mobile") {
    return <Image src="/assets/figma/hero-mobile.webp" width={390} height={633} alt="Друзья на фестивале «Предпринимай»" className="kit-hero-image" sizes="(max-width: 767px) 100vw, 20vw" />;
  }
  if (variant === "desktop") {
    return <Image src="/assets/figma/hero-desktop.webp" width={1440} height={960} alt="Друзья на фестивале «Предпринимай»" className="kit-hero-image" sizes="(max-width: 767px) 100vw, 60vw" priority />;
  }
  return (
    <picture>
      <source media="(max-width: 767px)" srcSet="/assets/figma/hero-mobile.webp" width={390} height={633} />
      {/* Native picture keeps the two art-directed Figma crops in a single semantic image. */}
      <img src="/assets/figma/hero-desktop.webp" width={1440} height={960} alt="Друзья на фестивале «Предпринимай»" className="kit-hero-image" />
    </picture>
  );
}
