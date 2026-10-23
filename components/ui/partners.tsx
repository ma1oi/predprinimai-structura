import Image from "next/image";

export function Partners() {
  return (
    <div className="kit-partners flex" role="list" aria-label="Партнёры фестиваля">
      {Array.from({ length: 6 }, (_, index) => (
        <div role="listitem" key={index} className="kit-partner shrink-0">
          <Image src={`/assets/figma/partner-${index % 2 + 1}.webp`} width={230} height={150} alt={index % 2 === 0 ? "Демидовский университет" : "Стартап-студия «Структура»"} sizes="(max-width: 767px) 150px, 12vw" />
        </div>
      ))}
    </div>
  );
}
