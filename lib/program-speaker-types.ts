export type ProgramSpeakerId = string;

export interface ProgramPresenter {
  id: string;
  name: string;
  job: string;
  photo: string;
}

export interface ProgramSpeaker {
  id: ProgramSpeakerId;
  title: string;
  time: string;
  description: string;
  presenters: ProgramPresenter[];
}

export interface ProgramSpeakerDocument {
  speakers: ProgramSpeaker[];
  revision: string;
}
