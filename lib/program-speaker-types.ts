export type ProgramSpeakerId = "registration" | "opening" | "business-session" | "effectiveness" | "success" | "coffee-break" | "ai-battle" | "ai-workshop" | "panfilov" | "internet-law" | "goncharenko" | "closing";

export interface ProgramSpeaker {
  id: ProgramSpeakerId;
  name: string;
  job: string;
  photo: string;
}

export interface ProgramSpeakerDocument {
  speakers: ProgramSpeaker[];
  revision: string;
}
