export type ProgramSpeakerId = string;

export interface ProgramSpeaker {
  id: ProgramSpeakerId;
  title: string;
  time: string;
  description: string;
  name: string;
  job: string;
  photo: string;
}

export interface ProgramSpeakerDocument {
  speakers: ProgramSpeaker[];
  revision: string;
}
