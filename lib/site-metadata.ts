export const site = {
  url: "https://pdrm.ru",
  name: "Предпринимай",
  title: "Предпринимай — фестиваль предпринимателей в Ярославле, 20 ноября",
  description: "20 ноября 2026 года в Ярославле — фестиваль молодых предпринимателей «Предпринимай». Выступления спикеров, нейросети для бизнеса и нетворкинг. Участие бесплатное, нужна регистрация.",
  image: "/assets/seo/festival-preview.jpg",
  imageAlt: "Участники фестиваля молодых предпринимателей «Предпринимай»",
};

export const festivalStructuredData = {
  "@context": "https://schema.org",
  "@type": "Event",
  "@id": `${site.url}/#festival`,
  name: "Предпринимай — фестиваль молодых предпринимателей",
  description: site.description,
  url: `${site.url}/`,
  startDate: "2026-11-20",
  eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
  eventStatus: "https://schema.org/EventScheduled",
  image: [`${site.url}${site.image}`],
  isAccessibleForFree: true,
  location: {
    "@type": "Place",
    name: "Ярославль",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Ярославль",
      addressCountry: "RU",
    },
  },
  offers: {
    "@type": "Offer",
    price: 0,
    priceCurrency: "RUB",
    url: `${site.url}/#registration`,
  },
};
