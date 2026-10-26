export interface Partner {
  id: string;
  name: string;
  logo: string;
  published: boolean;
}

export interface PartnerDocument {
  partners: Partner[];
  revision: string;
}
