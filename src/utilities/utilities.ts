import { point } from '../types';

// const minimumWhitish = 200;
const minimumWhitish = 240;
const minimumGreenDeltaForExactMatch = 24;   // not scientific.
const minimumRedDeltaForNotAtExactLocationMatch = 7;
const minimumGreenDeltaForNotAtExactLocationMatch = 40;
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
  if (isColorWhitish(red, green, blue)) return false;
  return (
    (Math.abs(red - green) < minimumColorDeltaForNotInWordMatch)
    && (Math.abs(red - blue) < minimumColorDeltaForNotInWordMatch)
    && (Math.abs(green - blue) < minimumColorDeltaForNotInWordMatch)
  );
}


export const isColorWhitish = (red: any, green: any, blue: any): boolean => {
  return (
    red >= minimumWhitish && green >= minimumWhitish && blue >= minimumWhitish
  );
}

