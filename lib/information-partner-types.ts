export interface InformationPartner {
  id: string;
  name: string;
  job: string;
  photo: string;
  socialUrl: string;
  published: boolean;
}

export interface InformationPartnerDocument {
  partners: InformationPartner[];
  revision: string;
}
