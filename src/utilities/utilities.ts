import { point } from '../types';

const minimumGreenDeltaForExactMatch = 35;   // not scientific.
const minimumRedDeltaForNotAtExactLocationMatch = 12;
const minimumGreenDeltaForNotAtExactLocationMatch = 50;
const minimumColorDeltaForNotInWordMatch = 10;

export function rectanglesOverlap(topLeft1: point, bottomRight1: point, topLeft2: point, bottomRight2: point) {
  if (topLeft1[0] > bottomRight2[0] || topLeft2[0] > bottomRight1[0]) {
    return false;
  }
  if (topLeft1[1] > bottomRight2[1] || topLeft2[1] > bottomRight1[1]) {
    return false;
  }
  return true;
}

export const isColorGreenish = (red: any, green: any, blue: any): boolean => {
  return ((green - red) > minimumGreenDeltaForExactMatch) && ((green - blue) > minimumGreenDeltaForExactMatch);
}

export const isColorGoldish = (red: any, green: any, blue: any): boolean => {
  return ((red - green) > minimumRedDeltaForNotAtExactLocationMatch) && ((green - blue) > minimumGreenDeltaForNotAtExactLocationMatch);
}

export const isColorGrayish = (red: any, green: any, blue: any): boolean => {
  if (isColorWhite(red, green, blue)) return false;
  return (
    (Math.abs(red - green) < minimumColorDeltaForNotInWordMatch)
    && (Math.abs(red - blue) < minimumColorDeltaForNotInWordMatch)
    && (Math.abs(green - blue) < minimumColorDeltaForNotInWordMatch)
  );
}

export const isColorWhite = (red: any, green: any, blue: any): boolean => {
  return (red = 255 && green === 255 && blue === 255);
}

