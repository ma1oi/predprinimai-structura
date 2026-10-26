export interface Prediction {
  id: string;
  text: string;
  published: boolean;
}

export interface PredictionDocument {
  predictions: Prediction[];
  revision: string;
}
