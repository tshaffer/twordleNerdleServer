export type point = [number, number];

export interface ContentIndicesByDirection {
  contentRowIndices: ContentIndices;
  contentColumnIndices: ContentIndices;
}

export interface ContentIndices {
  startIndices: number[];
  endIndices: number[];
}

export interface TwordleConfiguration {
  PORT: number;
}

export enum LetterAnswerType {
  NotInWord,
  InWordAtNonLocation,
  InWordAtExactLocation,
  Unknown,
}

export interface LetterAnswerValue {
  red: number;
  green: number;
  blue: number;
}

export const NotInWordValue: LetterAnswerValue = {
  red: 121,
  green: 124,
  blue: 126,
};

export const WhiteLetterValue: LetterAnswerValue = {
  red: 255,
  green: 255,
  blue: 255,
};

export const InWordAtNonLocationValue: LetterAnswerValue = {
  red: 198,
  green: 181,
  blue: 102,
};

export const InWordAtExactLocationValue: LetterAnswerValue = {
  red: 121,
  green: 168,
  blue: 107,
};

