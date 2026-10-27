import type { ProgramSpeakerId } from "./program-speaker-types";

export interface ProgramEvent {
  id: ProgramSpeakerId;
  time: string;
  title: string;
  height: number;
  description?: string;
}

export const programAgenda: readonly ProgramEvent[] = [
  {
    "time": "11:00-12:00",
    "title": "регистрация и знакомство",
    "height": 67,
    "id": "registration"
  },
  {
    "time": "12:00-12:05",
    "title": "Открытие фестиваля",
    "height": 67,
    "id": "opening"
  },
  {
    "time": "12:05–12:50",
    "title": "Спикер-сессия «Бизнес за зумерами: хайп или новая экономика?»",
    "height": 103,
    "id": "business-session"
  },
  {
    "time": "12:50-13:20",
    "title": "«Личная эффективность: почему сильные руководители работают меньше»",
    "height": 103,
    "id": "effectiveness"
  },
  {
    "time": "13:20-13:50",
    "title": "«Предприниматель: сколько стоит твой успех?»",
    "height": 85,
    "id": "success"
  },
  {
    "time": "13:50-14:20",
    "title": "Перерыв на кофе-брейк и интерактивы на площадке",
    "height": 85,
    "id": "coffee-break"
  },
  {
    "time": "14:20-14:40",
    "title": "Бизнес-батл «AI или здравый смысл?»",
    "height": 80,
    "id": "ai-battle"
  },
  {
    "time": "14:40-15:15",
    "title": "мастер-класс «нанять ai: как рекрутировать себе цифрового сотрудника»",
    "height": 126,
    "description": "Создание агентов для задач",
    "id": "ai-workshop"
  },
  {
    "time": "15:15-15:45",
    "title": "«не просто говорить, а внедрять: ai внутри бизнес-процессов»",
    "height": 185,
    "id": "panfilov"
  },
  {
    "time": "15:45-16:05",
    "title": "«бизнес под наблюдением: что сегодня нельзя делать в интернете»",
    "height": 103,
    "id": "internet-law"
  },
  {
    "time": "16:05-16:45",
    "title": "«Google уже мало: как нейросети выбирают бренды»",
    "height": 193,
    "id": "goncharenko"
  },
  {
    "time": "16:45-16:50",
    "title": "Закрытие фестиваля",
    "height": 67,
    "id": "closing"
  }
];
