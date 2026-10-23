export const stickers = [
  { id: "finally", text: "наконец-то свои", width: 212 },
  { id: "prime", text: "ты в прайме", width: 152 },
  { id: "welcome", text: "тебя тут ждали", width: 189 },
  { id: "understood", text: "здесь не нужно объяснять, чем ты занимаешься", width: 320 },
  { id: "idea", text: "идея на салфетке? нам подойдет", width: 226 },
  { id: "together", text: "не один в чате, не один в зале", width: 185 },
  { id: "festival", text: "иду на предпринимай 20 ноября", width: 266 },
] as const;

export const navigationItems = [
  { id: "home", label: "главная" },
  { id: "photos", label: "фото" },
  { id: "about", label: "о фестивале" },
  { id: "schedule", label: "программа" },
  { id: "speakers", label: "спикеры" },
] as const;

export type NavigationId = (typeof navigationItems)[number]["id"];

export const festivalPhotos = [
  { src: "/assets/figma/photo-1.webp", alt: "Участница фестиваля за столом", width: 190, height: 280 },
  { src: "/assets/figma/photo-2.webp", alt: "Участники слушают выступление в зале", width: 240, height: 330 },
  { src: "/assets/figma/photo-3.webp", alt: "Спикер с микрофоном на сцене", width: 240, height: 280 },
  { src: "/assets/figma/photo-4.webp", alt: "Знакомства и общение на фестивале", width: 240, height: 360 },
  { src: "/assets/figma/photo-5.webp", alt: "Участницы фестиваля в зрительном зале", width: 240, height: 300 },
  { src: "/assets/figma/photo-6.webp", alt: "Разговор участников фестиваля", width: 190, height: 280 },
] as const;
