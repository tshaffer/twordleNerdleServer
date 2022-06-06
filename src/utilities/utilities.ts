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

export const buildIsWhiteAtImageDataRGBIndex = (imageDataRGBA: Uint8ClampedArray): boolean[] => {

  const whiteAtImageDataRGBAIndex: boolean[] = [];

  for (let imageDataIndex = 0; imageDataIndex < imageDataRGBA.length; imageDataIndex += 4) {
    const red = imageDataRGBA[imageDataIndex];
    const green = imageDataRGBA[imageDataIndex + 1];
    const blue = imageDataRGBA[imageDataIndex + 2];
    if (isColorWhitish(red, green, blue)) {
      whiteAtImageDataRGBAIndex.push(true);
    } else {
      whiteAtImageDataRGBAIndex.push(false);
    }
  }
  return whiteAtImageDataRGBAIndex;
};

export const getWhiteRows = (canvasWidth: number, whiteAtImageDataRGBIndex: boolean[]): number[] => {

  const pixelOffsetFromEdge = 10;

  const whiteRows: number[] = [];

  for (let rowIndex = 0; rowIndex < canvasWidth; rowIndex++) {
    let allPixelsInRowAreWhite = true;
    for (let columnIndex = pixelOffsetFromEdge; columnIndex < (canvasWidth - (pixelOffsetFromEdge * 2)); columnIndex++) {
      // convert rowIndex, columnIndex into index into whiteAtImageDataRGBIndex
      const indexIntoWhiteAtImageDataRGBIndex = (rowIndex * canvasWidth) + columnIndex;
      if (!whiteAtImageDataRGBIndex[indexIntoWhiteAtImageDataRGBIndex]) {
        allPixelsInRowAreWhite = false;
        // break here if the code just breaks the inner loop
      }
    }
    if (allPixelsInRowAreWhite) {
      whiteRows.push(rowIndex);
    }
  }

  return whiteRows;
};

export const getWhiteColumns = (canvasWidth: number, canvasHeight: number, whiteAtImageDataRGBIndex: boolean[]): number[] => {

  const pixelOffsetFromEdge = 10;

  const whiteColumns: number[] = [];
  for (let columnIndex = 0; columnIndex < canvasWidth; columnIndex++) {
    let allPixelsInColumnAreWhite = true;
    for (let rowIndex = pixelOffsetFromEdge; rowIndex < (canvasHeight - (pixelOffsetFromEdge * 2)); rowIndex++) {
      // convert rowIndex, columnIndex into index into whiteAtImageDataRGBIndex
      const indexIntoWhiteAtImageDataRGBIndex = (rowIndex * canvasWidth) + columnIndex;
      if (!whiteAtImageDataRGBIndex[indexIntoWhiteAtImageDataRGBIndex]) {
        allPixelsInColumnAreWhite = false;
        // TEDTODO - break here
      }
    }
    if (allPixelsInColumnAreWhite) {
      whiteColumns.push(columnIndex);
    }
  }
  return whiteColumns;
};

export const isLetterAtExactLocation = (red: any, green: any, blue: any): boolean => {
  return isColorGreenish(red, green, blue);
};

export const isLetterNotAtExactLocation = (red: any, green: any, blue: any): boolean => {
  return isColorGoldish(red, green, blue);
};

export const isLetterNotInWord = (red: any, green: any, blue: any): boolean => {
  return isColorGrayish(red, green, blue);
};

