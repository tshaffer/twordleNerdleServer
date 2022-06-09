import * as fs from 'fs';
import { PNGWithMetadata } from 'pngjs';
import { LetterAnswerType } from '../types';

import { buildIsWhiteAtImageDataRGBIndex, getWhiteColumns, getWhiteRows, isColorWhitish, isLetterAtExactLocation, isLetterNotAtExactLocation, isLetterNotInWord } from '../utilities';

const PNG = require('pngjs').PNG;

interface NumberByNumberLUT {
  [id: number]: number;
}

interface WhiteRun {
  startColumn: number;
  runLength: number;
}

interface WhiteRunsInRow {
  imageFileRowIndex: number;
  whiteRuns: WhiteRun[];
}

export const generateImageForOCR = (path: string) => {

  var wordleFileData = fs.readFileSync(path);
  const png: PNGWithMetadata = PNG.sync.read(wordleFileData, {
    filterType: -1,
  });

  const gridCoordinates: any = getWordleGridData(png.width, png.height, png.data);
  const { xMin, yMin, xMax, yMax } = gridCoordinates;
  var dst = new PNG({ width: xMax - xMin + 1, height: yMax - yMin + 1 });
  PNG.bitblt(png, dst, xMin, yMin, xMax - xMin + 1, yMax - yMin + 1);

  const croppedBuffer = PNG.sync.write(dst);
  fs.writeFileSync('public/croppedWordleOut.png', croppedBuffer);

  prepareImageForOCR(dst.width, dst.height, dst.data);

  const buffer = PNG.sync.write(dst);
  fs.writeFileSync('wordleOut.png', buffer);
}

const getWordleGridData = (imageWidth: number, imageHeight: number, imageData: Buffer): any => {

  const whiteRunsInRows: WhiteRunsInRow[] = buildWhiteRunsInRows(imageWidth, imageHeight, imageData);
  const rowsWith6WhiteRunsOrMore: WhiteRunsInRow[] = getRowsWith6WhiteRunsOrMore(whiteRunsInRows);

  const numberOfRowsWithEqualInitialWhiteRunLength: NumberByNumberLUT = {};
  rowsWith6WhiteRunsOrMore.forEach((rowWith6WhiteRunsOrMore: WhiteRunsInRow) => {
    const initialRunLength = rowWith6WhiteRunsOrMore.whiteRuns[0].runLength
    if (!numberOfRowsWithEqualInitialWhiteRunLength.hasOwnProperty(initialRunLength)) {
      numberOfRowsWithEqualInitialWhiteRunLength[initialRunLength] = 0;
    }
    numberOfRowsWithEqualInitialWhiteRunLength[initialRunLength]++;
  })

  // get the interesting initial white run length value
  let initialWhiteRunLengthForRowsWithMostCommonInitialWhiteRunLength = -1;

  let highestNumberOfRowsWithCommonInitialWhiteRunLength = 0;
  for (const initialWhiteRunLength in numberOfRowsWithEqualInitialWhiteRunLength) {
    if (Object.prototype.hasOwnProperty.call(numberOfRowsWithEqualInitialWhiteRunLength, initialWhiteRunLength)) {
      const numberOfRowsWithThisInitialWhiteRunLength = numberOfRowsWithEqualInitialWhiteRunLength[initialWhiteRunLength];
      if (numberOfRowsWithThisInitialWhiteRunLength > highestNumberOfRowsWithCommonInitialWhiteRunLength) {
        highestNumberOfRowsWithCommonInitialWhiteRunLength = numberOfRowsWithThisInitialWhiteRunLength;
        initialWhiteRunLengthForRowsWithMostCommonInitialWhiteRunLength = parseInt(initialWhiteRunLength, 10);
      }
    }
  }

  // build list of rows with this initial white run length
  const rowsWithMaxInitialWhiteRunLength: WhiteRunsInRow[] = [];
  rowsWith6WhiteRunsOrMore.forEach((whiteRunsInRow: WhiteRunsInRow) => {
    const initialRunLength = whiteRunsInRow.whiteRuns[0].runLength
    if (initialRunLength === initialWhiteRunLengthForRowsWithMostCommonInitialWhiteRunLength) {
      rowsWithMaxInitialWhiteRunLength.push(whiteRunsInRow);
    }
  })

  const xMin: number = rowsWithMaxInitialWhiteRunLength[0].whiteRuns[0].runLength;
  const yMin: number = rowsWithMaxInitialWhiteRunLength[0].imageFileRowIndex;
  const xMax: number = rowsWithMaxInitialWhiteRunLength[0].whiteRuns[rowsWithMaxInitialWhiteRunLength[0].whiteRuns.length - 1].startColumn;
  const yMax: number = rowsWithMaxInitialWhiteRunLength[rowsWithMaxInitialWhiteRunLength.length - 1].imageFileRowIndex;

  return {
    xMin,
    yMin,
    xMax,
    yMax
  };
}

const prepareImageForOCR = (imageWidth: number, imageHeight: number, data: Buffer) => {
  const whiteAtImageDataRGBIndex: boolean[] = buildIsWhiteAtImageDataRGBIndex(data as unknown as Uint8ClampedArray);
  const whiteRows: number[] = getWhiteRows(imageWidth, whiteAtImageDataRGBIndex);
  const whiteColumns: number[] = getWhiteColumns(imageWidth, imageHeight, whiteAtImageDataRGBIndex);
  convertWhiteRowsToBlack(imageWidth, whiteRows, data as unknown as Uint8ClampedArray);
  convertWhiteColumnsToBlack(imageWidth, imageHeight, whiteColumns, data as unknown as Uint8ClampedArray);
  convertBackgroundColorsToBlack(data);
}

const buildWhiteRunsInRows = (imageWidth: number, imageHeight: number, imageData: Buffer): WhiteRunsInRow[] => {

  const whiteRunsInRows: WhiteRunsInRow[] = [];

  const isWhiteAtImageDataRGBIndex: boolean[] = buildIsWhiteAtImageDataRGBIndex(imageData as unknown as Uint8ClampedArray);

  let inWhiteRun: boolean = false;
  let whiteRunLength: number = 0;
  let columnIndexOfWhiteRunStart = 0;

  for (let imageFileRowIndex = 0; imageFileRowIndex < imageHeight; imageFileRowIndex++) {

    // don't care about trailing white run in prior row

    inWhiteRun = false;

    const currentWhiteRunsInRow: WhiteRunsInRow = {
      imageFileRowIndex,
      whiteRuns: [],
    };
    whiteRunsInRows.push(currentWhiteRunsInRow);

    for (let imageFileColumnIndex = 0; imageFileColumnIndex < imageWidth; imageFileColumnIndex++) {
      const indexIntoWhiteAtImageDataRGBIndex = (imageFileRowIndex * imageWidth) + imageFileColumnIndex;
      if (!isWhiteAtImageDataRGBIndex[indexIntoWhiteAtImageDataRGBIndex]) {
        if (inWhiteRun) {
          const completedWhiteRun: WhiteRun = {
            startColumn: columnIndexOfWhiteRunStart,
            runLength: whiteRunLength,
          };
          currentWhiteRunsInRow.whiteRuns.push(completedWhiteRun);
          inWhiteRun = false;
        }
      } else {
        if (!inWhiteRun) {
          inWhiteRun = true;
          whiteRunLength = 1;
          columnIndexOfWhiteRunStart = imageFileColumnIndex;
        } else {
          whiteRunLength++;
        }
      }
    }

    // capture last white run - it doesn't appear that this ever occurs
    // TEDTODO
    if (inWhiteRun) {
      console.log('floopers');
    }
  }

  return whiteRunsInRows;
}

const convertWhiteRowsToBlack = (canvasWidth: number, whiteRows: number[], imageDataRGB: Uint8ClampedArray) => {
  for (let rowIndex = 0; rowIndex < whiteRows.length; rowIndex++) {
    const whiteRowIndex = whiteRows[rowIndex];
    const rowStartIndex = whiteRowIndex * canvasWidth * 4;
    for (let columnIndex = 0; columnIndex < canvasWidth; columnIndex++) {
      const columnOffset = columnIndex * 4;
      imageDataRGB[rowStartIndex + columnOffset] = 0;
      imageDataRGB[rowStartIndex + columnOffset + 1] = 0;
      imageDataRGB[rowStartIndex + columnOffset + 2] = 0;
    }
  }
};

const convertWhiteColumnsToBlack = (canvasWidth: number, canvasHeight: number, whiteColumns: number[], imageDataRGB: Uint8ClampedArray) => {
  for (let indexIntoWhiteColumns = 0; indexIntoWhiteColumns < whiteColumns.length; indexIntoWhiteColumns++) {
    const whiteColumnIndex = whiteColumns[indexIntoWhiteColumns];
    for (let rowIndex = 0; rowIndex < canvasHeight; rowIndex++) {
      const offset = offsetFromPosition(canvasWidth, rowIndex, whiteColumnIndex);
      imageDataRGB[offset] = 0;
      imageDataRGB[offset + 1] = 0;
      imageDataRGB[offset + 2] = 0;
    }
  }
};

const convertBackgroundColorsToBlack = (imgData: Buffer) => {
  for (let i = 0; i < imgData.length; i = i + 4) {
    const red = imgData[i];
    const green = imgData[i + 1];
    const blue = imgData[i + 2];
    const letterAnswerType: LetterAnswerType = getLetterAnswerTypeRgb(red, green, blue);
    if (letterAnswerType !== LetterAnswerType.Unknown) {
      imgData[i] = 0;
      imgData[i + 1] = 0;
      imgData[i + 2] = 0;
    }
  }
};

const getRowsWith6WhiteRunsOrMore = (whiteRunsInRows: WhiteRunsInRow[]): WhiteRunsInRow[] => {

  const rowsWith6WhiteRunsOrMore: WhiteRunsInRow[] = [];

  for (let index = 0; index < whiteRunsInRows.length; index++) {
    const whiteRunsInRow: WhiteRunsInRow = whiteRunsInRows[index];
    if (whiteRunsInRow.whiteRuns.length >= 6) {
      rowsWith6WhiteRunsOrMore.push(whiteRunsInRow);
    }
  }

  return rowsWith6WhiteRunsOrMore;
}

const offsetFromPosition = (canvasWidth: number, row: number, column: number): number => {
  const offset = (row * canvasWidth * 4) + (column * 4);
  return offset;
};

const getLetterAnswerTypeRgb = (red: any, green: any, blue: any): LetterAnswerType => {

  if (isLetterAtExactLocation(red, green, blue)) {
    return LetterAnswerType.InWordAtExactLocation;
  } else if (isLetterNotAtExactLocation(red, green, blue)) {
    return LetterAnswerType.InWordAtNonLocation;
  } else if (isLetterNotInWord(red, green, blue)) {
    return LetterAnswerType.NotInWord;
  }
  return LetterAnswerType.Unknown;
};

