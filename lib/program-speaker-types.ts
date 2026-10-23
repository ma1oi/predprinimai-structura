export type ProgramSpeakerId = "panfilov" | "goncharenko";

export interface ProgramSpeaker {
  id: ProgramSpeakerId;
  name: string;
  photo: string;
}

export interface ProgramSpeakerDocument {
  speakers: ProgramSpeaker[];
  revision: string;
}
