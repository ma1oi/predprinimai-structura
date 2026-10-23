export interface RegistrationInput {
  requestId: string;
  name: string;
  phone: string;
  company: string;
  consent: boolean;
}

export interface Registration {
  id: string;
  requestId: string;
  name: string;
  phone: string;
  company: string;
  consent: true;
  createdAt: string;
}
