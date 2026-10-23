export const speakerColors = ["lime", "lavender", "pink"] as const;

export interface Speaker {
  id: string;
  name: string;
  job: string;
  topic: string;
  time: string;
  photo: string;
  color: typeof speakerColors[number];
  published: boolean;
  art: "blue" | "pink";
}

export interface SpeakerDocument {
  speakers: Speaker[];
  revision: string;
}
