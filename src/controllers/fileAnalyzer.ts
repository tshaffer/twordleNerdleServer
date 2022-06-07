import * as fs from 'fs';
import { PNGWithMetadata } from 'pngjs';
import { LetterAnswerType } from '../types';

import { buildIsWhiteAtImageDataRGBIndex, getWhiteColumns, getWhiteRows, isColorWhitish, isLetterAtExactLocation, isLetterNotAtExactLocation, isLetterNotInWord } from '../utilities';

const PNG = require('pngjs').PNG;

interface NumberByNumberLUT {
  [id: number]: number;
}

interface WhiteRunsInRowOrColumn {
  imageFileRowOrColumnIndex: number;
  whiteRuns: WhiteRunNew[];
  runLength: number;            // TEDTODO - how is this single runLength determined? variable name?
}

interface WhiteRunNew {
  startIndex: number;
  runLength: number;
}















// interface WhiteRunNew {
//   startRow: number;
//   runLength: number;
// }

interface WhiteRunsInColumn {
  imageFileColumnIndex: number;
  whiteRuns: WhiteRunNew[];
  runLength: number;            // TEDTODO - how is this single runLength determined? variable name?
}



interface WhiteRun {
  startColumn: number;
  runLength: number;
}

interface WhiteRunsInRow {
  imageFileRowIndex: number;
  whiteRuns: WhiteRun[];
  runLength: number;            // TEDTODO - how is this single runLength determined? variable name?
}

interface WhiteRunsInRowWithFourOrMoreEqualRunLengths {
  imageFileRowIndex: number;
  runLength: number;
}

interface WhiteRunsInColumnsWithFiveOrMoreEqualRunLengths {
  imageFileColumnIndex: number;
  runLength: number;
}

interface RowBlockEntry {
  imageFileRowIndex: number;
  indexOfBlockStart: number;
  numberOfRowsInBlock: number;
  whiteRunLength: number;
}

interface ColumnBlockEntry {
  imageFileColumnIndex: number;
  indexOfBlockStart: number;
  numberOfColumnsInBlock: number;
  whiteRunLength: number;
}


interface WordleGridData {
  imageFileRowIndices: number[],
  whiteRunLength: number,
}

export const getTextUsingOCR = (path: string) => {

  var wordleFileData = fs.readFileSync(path);
  const png: PNGWithMetadata = PNG.sync.read(wordleFileData, {
    filterType: -1,
  });

  const wordleGridData: WordleGridData = getWordleGridData(png.width, png.height, png.data);
  const imageFileRowIndices: number[] = wordleGridData.imageFileRowIndices;
  const whiteRunLength: number = wordleGridData.whiteRunLength;

  imageFileRowIndices.sort();

  const gridItemSize: number = imageFileRowIndices[1] - imageFileRowIndices[0];
  const gridSize: number = (gridItemSize * 5) - whiteRunLength;
  const gridStartX: number = 1327;    // TEDTODOWORDLE
  const gridStartY: number = imageFileRowIndices[0];

  var dst = new PNG({ width: gridSize, height: gridSize });
  PNG.bitblt(png, dst, gridStartX, gridStartY, gridSize, gridSize);

  const croppedBuffer = PNG.sync.write(dst);
  fs.writeFileSync('public/croppedWordleOut.png', croppedBuffer);

  prepareImageForOCR(dst.width, dst.height, dst.data);

  const buffer = PNG.sync.write(dst);
  fs.writeFileSync('wordleOut.png', buffer);
}

const prepareImageForOCR = (imageWidth: number, imageHeight: number, data: Buffer) => {
  const whiteAtImageDataRGBIndex: boolean[] = buildIsWhiteAtImageDataRGBIndex(data as unknown as Uint8ClampedArray);
  const whiteRows: number[] = getWhiteRows(imageWidth, whiteAtImageDataRGBIndex);
  const whiteColumns: number[] = getWhiteColumns(imageWidth, imageHeight, whiteAtImageDataRGBIndex);
  convertWhiteRowsToBlack(imageWidth, whiteRows, data as unknown as Uint8ClampedArray);
  convertWhiteColumnsToBlack(imageWidth, imageHeight, whiteColumns, data as unknown as Uint8ClampedArray);
  convertBackgroundColorsToBlack(data);
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
    // const columnStartIndex = whiteColumnIndex * imageHeight * 4;
    for (let rowIndex = 0; rowIndex < canvasHeight; rowIndex++) {
      const offset = offsetFromPosition(canvasWidth, rowIndex, whiteColumnIndex);
      // const columnOffset = columnIndex * 4;
      imageDataRGB[offset] = 0;
      imageDataRGB[offset + 1] = 0;
      imageDataRGB[offset + 2] = 0;
    }
  }
};

const convertBackgroundColorsToBlack = (imgData: Buffer) => {
  // for (let i = 0; i < imgData.length; i += 4) {
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

const getWordleGridData = (imageWidth: number, imageHeight: number, imageData: Buffer): WordleGridData => {

  const whiteRunsInRows: WhiteRunsInRow[] = buildWhiteRunsInRows(imageWidth, imageHeight, imageData);
  const whiteRunsInColumns: WhiteRunsInColumn[] = buildWhiteRunsInColumns(imageWidth, imageHeight, imageData);

  const rowBlockEntries: RowBlockEntry[] = processWhiteRunsInRows(whiteRunsInRows);
  const columnBlockEntries: ColumnBlockEntry[] = processWhiteRunsInColumns(whiteRunsInColumns);

  const wordleGridData: WordleGridData = getWordleGridDataFromBlockEntries(rowBlockEntries, columnBlockEntries);

  return wordleGridData;
}

const buildWhiteRunsInRows = (imageWidth: number, imageHeight: number, imageData: Buffer): WhiteRunsInRow[] => {

  const whiteRunsInRows: WhiteRunsInRow[] = [];

  const isWhiteAtImageDataRGBIndex: boolean[] = buildIsWhiteAtImageDataRGBIndex(imageData as unknown as Uint8ClampedArray);

  let inWhiteRun: boolean = false;
  let whiteRunLength: number = 0;
  let rowIndexOfWhiteRun = 0;
  let columnIndexOfWhiteRunStart = 0;

  for (let imageFileRowIndex = 0; imageFileRowIndex < imageHeight; imageFileRowIndex++) {

    // don't care about trailing white run in prior row

    inWhiteRun = false;

    const currentWhiteRunsInRow: WhiteRunsInRow = { imageFileRowIndex, whiteRuns: [], runLength: -1 };
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
          rowIndexOfWhiteRun = imageFileRowIndex;
          columnIndexOfWhiteRunStart = imageFileColumnIndex;
        } else {
          whiteRunLength++;
        }
      }
    }
  }

  return whiteRunsInRows;
}

const buildWhiteRunsInColumns = (imageWidth: number, imageHeight: number, imageData: Buffer): WhiteRunsInColumn[] => {

  const whiteRunsInColumns: WhiteRunsInColumn[] = [];

  const isWhiteAtImageDataRGBIndex: boolean[] = buildIsWhiteAtImageDataRGBIndex(imageData as unknown as Uint8ClampedArray);

  let inWhiteRun: boolean = false;
  let whiteRunLength: number = 0;
  let columnIndexOfWhiteRun = 0;
  let rowIndexOfWhiteRunStart = 0;

  for (let imageFileColumnIndex = 0; imageFileColumnIndex < imageWidth; imageFileColumnIndex++) {

    // don't care about trailing white run in prior row

    inWhiteRun = false;

    const currentWhiteRunsInRow: WhiteRunsInColumn = { imageFileColumnIndex, whiteRuns: [], runLength: -1 };
    whiteRunsInColumns.push(currentWhiteRunsInRow);

    for (let imageFileRowIndex = 0; imageFileRowIndex < imageHeight; imageFileRowIndex++) {
      const indexIntoWhiteAtImageDataRGBIndex = (imageFileRowIndex * imageWidth) + imageFileColumnIndex;
      if (!isWhiteAtImageDataRGBIndex[indexIntoWhiteAtImageDataRGBIndex]) {
        if (inWhiteRun) {
          const completedWhiteRun: WhiteRunNew = {
            startIndex: rowIndexOfWhiteRunStart,
            runLength: whiteRunLength,
          };
          currentWhiteRunsInRow.whiteRuns.push(completedWhiteRun);
          inWhiteRun = false;
        }
      } else {
        if (!inWhiteRun) {
          inWhiteRun = true;
          whiteRunLength = 1;
          columnIndexOfWhiteRun = imageFileColumnIndex;
          rowIndexOfWhiteRunStart = imageFileRowIndex;
        } else {
          whiteRunLength++;
        }
      }
    }
  }

  return whiteRunsInColumns;
}



const buildWhiteRunsInRowsOrColumns = (imageLengthInOtherDirection: number, imageLengthInDirection: number, imageData: Buffer): WhiteRunsInRowOrColumn[] => {

  const whiteRunsInRowsOrColumns: WhiteRunsInRowOrColumn[] = [];

  const isWhiteAtImageDataRGBIndex: boolean[] = buildIsWhiteAtImageDataRGBIndex(imageData as unknown as Uint8ClampedArray);

  let inWhiteRun: boolean = false;
  let whiteRunLength: number = 0;
  let rowOrColumnIndexOfWhiteRun = 0;
  let rowOrColumnIndexOfWhiteRunStart = 0;

  for (let imageFileRowOrColumnIndex = 0; imageFileRowOrColumnIndex < imageLengthInDirection; imageFileRowOrColumnIndex++) {

    // don't care about trailing white run in prior row

    inWhiteRun = false;

    const currentWhiteRunsInRowOrColumn: WhiteRunsInRowOrColumn = { imageFileRowOrColumnIndex, whiteRuns: [], runLength: -1 };
    whiteRunsInRowsOrColumns.push(currentWhiteRunsInRowOrColumn);

    for (let imageFileColumnOrRowIndex = 0; imageFileColumnOrRowIndex < imageLengthInOtherDirection; imageFileColumnOrRowIndex++) {
      const indexIntoWhiteAtImageDataRGBIndex = (imageFileRowOrColumnIndex * imageLengthInOtherDirection) + imageFileColumnOrRowIndex;
      if (!isWhiteAtImageDataRGBIndex[indexIntoWhiteAtImageDataRGBIndex]) {
        if (inWhiteRun) {
          const completedWhiteRun: WhiteRunNew = {
            startIndex: rowOrColumnIndexOfWhiteRunStart,
            runLength: whiteRunLength,
          };
          currentWhiteRunsInRowOrColumn.whiteRuns.push(completedWhiteRun);
          inWhiteRun = false;
        }
      } else {
        if (!inWhiteRun) {
          inWhiteRun = true;
          whiteRunLength = 1;
          rowOrColumnIndexOfWhiteRun = imageFileRowOrColumnIndex;
          rowOrColumnIndexOfWhiteRunStart = imageFileColumnOrRowIndex;
        } else {
          whiteRunLength++;
        }
      }
    }
  }

  return whiteRunsInRowsOrColumns;

}

const buildRowsWithFourOrMoreEqualWhiteRunLengths = (whiteRunsInRows: WhiteRunsInRow[]): WhiteRunsInRowWithFourOrMoreEqualRunLengths[] => {

  const rowsWithFourOrMoreEqualWhiteRunLengths: WhiteRunsInRowWithFourOrMoreEqualRunLengths[] = [];

  for (const whiteRunsInRow of whiteRunsInRows) {
    // for this to be a row that might include a letter, it must have at least 6 white runs
    // one before the grid; four inside the grid; one after the grid
    // note - if the user has entered a character into a row, there may be additional white runs
    if (whiteRunsInRow.whiteRuns.length >= 6) {

      // check for instance(s) of 4 or more whiteRuns that have 'equivalent' length

      // build structure that indicates that number of runs in a single row by runLength
      const numberOfRunsForGivenRunLength: NumberByNumberLUT = {}
      for (let indexOfWhiteRunInRow = 0; indexOfWhiteRunInRow < whiteRunsInRow.whiteRuns.length; indexOfWhiteRunInRow++) {
        const runLengthAtThisIndex: number = whiteRunsInRow.whiteRuns[indexOfWhiteRunInRow].runLength;
        if (!numberOfRunsForGivenRunLength.hasOwnProperty(runLengthAtThisIndex.toString())) {
          numberOfRunsForGivenRunLength[runLengthAtThisIndex] = 0;
        }
        numberOfRunsForGivenRunLength[runLengthAtThisIndex]++;
      }

      // capture each instance where there are four or more white runs with an equivalent length.
      for (const runLength in numberOfRunsForGivenRunLength) {
        if (Object.prototype.hasOwnProperty.call(numberOfRunsForGivenRunLength, runLength)) {
          const numberOfRuns = numberOfRunsForGivenRunLength[runLength];
          if (numberOfRuns >= 4) {
            const lastIndex = rowsWithFourOrMoreEqualWhiteRunLengths.length - 1;
            if (lastIndex > 0) {
              // there may be circumstances where a single row has more than one run length with 4 or more instances.
              // in this case, use the first instance (already pushed) and discard the second instance
              const lastPushedRowIndex = rowsWithFourOrMoreEqualWhiteRunLengths[lastIndex].imageFileRowIndex;
              const newRowIndex = whiteRunsInRow.imageFileRowIndex;
              if (newRowIndex > lastPushedRowIndex) {
                const rowWithFourOrMoreEqualRunLengths: WhiteRunsInRowWithFourOrMoreEqualRunLengths = {
                  imageFileRowIndex: whiteRunsInRow.imageFileRowIndex,
                  runLength: parseInt(runLength, 10),
                };
                rowsWithFourOrMoreEqualWhiteRunLengths.push(rowWithFourOrMoreEqualRunLengths);
              }
            } else {
              const rowWithFourOrMoreEqualRunLengths: WhiteRunsInRowWithFourOrMoreEqualRunLengths = {
                imageFileRowIndex: whiteRunsInRow.imageFileRowIndex,
                runLength: parseInt(runLength, 10),
              };
              rowsWithFourOrMoreEqualWhiteRunLengths.push(rowWithFourOrMoreEqualRunLengths);
            }
          }
        }
      }
    }
  }

  return rowsWithFourOrMoreEqualWhiteRunLengths;
}

const buildColumnsWithFiveOrMoreEqualWhiteRunLengths = (whiteRunsInColumns: WhiteRunsInColumn[]): WhiteRunsInColumnsWithFiveOrMoreEqualRunLengths[] => {

  const columnsWithFiveOrMoreEqualWhiteRunLengths: WhiteRunsInColumnsWithFiveOrMoreEqualRunLengths[] = [];

  for (const whiteRunsInColumn of whiteRunsInColumns) {
    // for this to be a column that might include a letter, it must have at least 7 white runs
    // one before the grid; five inside the grid; one after the grid
    // note - if the user has entered a character into a row, there may be additional white runs
    if (whiteRunsInColumn.whiteRuns.length >= 6) {

      // check for instance(s) of 4 or more whiteRuns that have 'equivalent' length

      // build structure that indicates that number of runs in a single row by runLength
      const numberOfRunsForGivenRunLength: NumberByNumberLUT = {}
      for (let indexOfWhiteRunInColumn = 0; indexOfWhiteRunInColumn < whiteRunsInColumn.whiteRuns.length; indexOfWhiteRunInColumn++) {
        const runLengthAtThisIndex: number = whiteRunsInColumn.whiteRuns[indexOfWhiteRunInColumn].runLength;
        if (!numberOfRunsForGivenRunLength.hasOwnProperty(runLengthAtThisIndex.toString())) {
          numberOfRunsForGivenRunLength[runLengthAtThisIndex] = 0;
        }
        numberOfRunsForGivenRunLength[runLengthAtThisIndex]++;
      }

      // capture each instance where there are five or more white runs with an equivalent length.
      for (const runLength in numberOfRunsForGivenRunLength) {
        if (Object.prototype.hasOwnProperty.call(numberOfRunsForGivenRunLength, runLength)) {
          const numberOfRuns = numberOfRunsForGivenRunLength[runLength];
          if (numberOfRuns >= 5) {
            const lastIndex = columnsWithFiveOrMoreEqualWhiteRunLengths.length - 1;
            if (lastIndex > 0) {
              // there may be circumstances where a single column has more than one run length with 4 or more instances.
              // in this case, use the first instance (already pushed) and discard the second instance
              const lastPushedColumnIndex = columnsWithFiveOrMoreEqualWhiteRunLengths[lastIndex].imageFileColumnIndex;
              const newColumnIndex = whiteRunsInColumn.imageFileColumnIndex;
              if (newColumnIndex > lastPushedColumnIndex) {
                const columnWithFourOrMoreEqualRunLengths: WhiteRunsInColumnsWithFiveOrMoreEqualRunLengths = {
                  imageFileColumnIndex: whiteRunsInColumn.imageFileColumnIndex,
                  runLength: parseInt(runLength, 10),
                };
                columnsWithFiveOrMoreEqualWhiteRunLengths.push(columnWithFourOrMoreEqualRunLengths);
              }
            } else {
              const columnWithFourOrMoreEqualRunLengths: WhiteRunsInColumnsWithFiveOrMoreEqualRunLengths = {
                imageFileColumnIndex: whiteRunsInColumn.imageFileColumnIndex,
                runLength: parseInt(runLength, 10),
              };
              columnsWithFiveOrMoreEqualWhiteRunLengths.push(columnWithFourOrMoreEqualRunLengths);
            }
          }
        }
      }
    }
  }

  return columnsWithFiveOrMoreEqualWhiteRunLengths;
}


/*
  look for entries in rowsWithFourEqualWhiteRunLengths where the row index is one greater than the row index of the prior entry in rowsWithFourEqualWhiteRunLengths and one less than the row index of the next entry in rowsOfWhiteRunsFilter0.
  create a data structure to store these blocks with entries that match the above criteria
*/
const buildRowBlockEntries = (rowsWithFourOrMoreEqualWhiteRunLengths: WhiteRunsInRowWithFourOrMoreEqualRunLengths[]): RowBlockEntry[] => {

  const blockEntries: RowBlockEntry[] = [];

  let inBlock = false;
  let numberOfRowsInBlock = 0;
  let indexOfBlockStart = 0;      // index into rowsWithFourOrMoreEqualWhiteRunLengths where block starts
  let imageFileRowIndex = 0;      // index into image data structure
  let whiteRunLength = -1;

  // special case first row
  const rowWithFourOrMoreEqualWhiteRunLengths: WhiteRunsInRowWithFourOrMoreEqualRunLengths = rowsWithFourOrMoreEqualWhiteRunLengths[0];
  const nextRowWithFourOrMoreEqualWhiteRunLengths: WhiteRunsInRowWithFourOrMoreEqualRunLengths = rowsWithFourOrMoreEqualWhiteRunLengths[1];
  if (rowWithFourOrMoreEqualWhiteRunLengths.imageFileRowIndex === (nextRowWithFourOrMoreEqualWhiteRunLengths.imageFileRowIndex - 1)) {
    inBlock = true;
    indexOfBlockStart = 0;
    numberOfRowsInBlock = 1;
  }

  for (let index = 1; (index < rowsWithFourOrMoreEqualWhiteRunLengths.length - 1); index++) {

    const priorRowWithFourOrMoreEqualWhiteRunLengths: WhiteRunsInRowWithFourOrMoreEqualRunLengths = rowsWithFourOrMoreEqualWhiteRunLengths[index - 1];
    const rowWithFourOrMoreEqualWhiteRunLengths: WhiteRunsInRowWithFourOrMoreEqualRunLengths = rowsWithFourOrMoreEqualWhiteRunLengths[index];
    const nextRowWithFourOrMoreEqualWhiteRunLengths: WhiteRunsInRowWithFourOrMoreEqualRunLengths = rowsWithFourOrMoreEqualWhiteRunLengths[index + 1];

    if (rowWithFourOrMoreEqualWhiteRunLengths.imageFileRowIndex === (priorRowWithFourOrMoreEqualWhiteRunLengths.imageFileRowIndex + 1)
      && rowWithFourOrMoreEqualWhiteRunLengths.imageFileRowIndex === (nextRowWithFourOrMoreEqualWhiteRunLengths.imageFileRowIndex - 1)) {
      // in block
      if (!inBlock) {
        inBlock = true;
        indexOfBlockStart = index - 1;
        imageFileRowIndex = rowWithFourOrMoreEqualWhiteRunLengths.imageFileRowIndex;
        numberOfRowsInBlock = 2;
        whiteRunLength = rowWithFourOrMoreEqualWhiteRunLengths.runLength;
      }
      numberOfRowsInBlock++;

    } else {
      if (inBlock && numberOfRowsInBlock >= 4) {
        const blockEntry: RowBlockEntry = {
          imageFileRowIndex,
          indexOfBlockStart,
          numberOfRowsInBlock,
          whiteRunLength,
        };
        blockEntries.push(blockEntry);

        inBlock = false;
      }
    }
  }

  // TEDTODO **** special case last row

  return blockEntries;
}

const buildColumnBlockEntries = (columnsWithFourOrMoreEqualWhiteRunLengths: WhiteRunsInColumnsWithFiveOrMoreEqualRunLengths[]): ColumnBlockEntry[] => {

  const blockEntries: ColumnBlockEntry[] = [];

  let inBlock = false;
  let numberOfColumnsInBlock = 0;
  let indexOfBlockStart = 0;      // index into columnsWithFourOrMoreEqualWhiteRunLengths where block starts
  let imageFileColumnIndex = 0;      // index into image data structure
  let whiteRunLength = -1;

  // special case first column
  const columnWithFourOrMoreEqualWhiteRunLengths: WhiteRunsInColumnsWithFiveOrMoreEqualRunLengths = columnsWithFourOrMoreEqualWhiteRunLengths[0];
  const nextColumnWithFourOrMoreEqualWhiteRunLengths: WhiteRunsInColumnsWithFiveOrMoreEqualRunLengths = columnsWithFourOrMoreEqualWhiteRunLengths[1];
  if (columnWithFourOrMoreEqualWhiteRunLengths.imageFileColumnIndex === (nextColumnWithFourOrMoreEqualWhiteRunLengths.imageFileColumnIndex - 1)) {
    inBlock = true;
    indexOfBlockStart = 0;
    numberOfColumnsInBlock = 1;
  }

  for (let index = 1; (index < columnsWithFourOrMoreEqualWhiteRunLengths.length - 1); index++) {

    const priorColumnWithFourOrMoreEqualWhiteRunLengths: WhiteRunsInColumnsWithFiveOrMoreEqualRunLengths = columnsWithFourOrMoreEqualWhiteRunLengths[index - 1];
    const columnWithFourOrMoreEqualWhiteRunLengths: WhiteRunsInColumnsWithFiveOrMoreEqualRunLengths = columnsWithFourOrMoreEqualWhiteRunLengths[index];
    const nextColumnWithFourOrMoreEqualWhiteRunLengths: WhiteRunsInColumnsWithFiveOrMoreEqualRunLengths = columnsWithFourOrMoreEqualWhiteRunLengths[index + 1];

    if (columnWithFourOrMoreEqualWhiteRunLengths.imageFileColumnIndex === (priorColumnWithFourOrMoreEqualWhiteRunLengths.imageFileColumnIndex + 1)
      && columnWithFourOrMoreEqualWhiteRunLengths.imageFileColumnIndex === (nextColumnWithFourOrMoreEqualWhiteRunLengths.imageFileColumnIndex - 1)) {
      // in block
      if (!inBlock) {
        inBlock = true;
        indexOfBlockStart = index - 1;
        imageFileColumnIndex = columnWithFourOrMoreEqualWhiteRunLengths.imageFileColumnIndex;
        numberOfColumnsInBlock = 2;
        whiteRunLength = columnWithFourOrMoreEqualWhiteRunLengths.runLength;
      }
      numberOfColumnsInBlock++;

    } else {
      if (inBlock && numberOfColumnsInBlock >= 4) {
        const blockEntry: ColumnBlockEntry = {
          imageFileColumnIndex,
          indexOfBlockStart,
          numberOfColumnsInBlock,
          whiteRunLength,
        };
        blockEntries.push(blockEntry);

        inBlock = false;
      }
    }
  }

  // TEDTODO **** special case last column

  return blockEntries;
}


const processWhiteRunsInRows = (whiteRunsInRows: WhiteRunsInRow[]): RowBlockEntry[] => {

  const rowsWithFourOrMoreEqualWhiteRunLengths: WhiteRunsInRowWithFourOrMoreEqualRunLengths[] = buildRowsWithFourOrMoreEqualWhiteRunLengths(whiteRunsInRows);

  const blockEntries: RowBlockEntry[] = buildRowBlockEntries(rowsWithFourOrMoreEqualWhiteRunLengths);
  console.log(blockEntries);

  return blockEntries;
}

const processWhiteRunsInColumns = (whiteRunsInColumns: WhiteRunsInColumn[]): ColumnBlockEntry[] => {

  const columnsWithFourOrMoreEqualWhiteRunLengths: WhiteRunsInColumnsWithFiveOrMoreEqualRunLengths[] = buildColumnsWithFiveOrMoreEqualWhiteRunLengths(whiteRunsInColumns);

  const blockEntries: ColumnBlockEntry[] = buildColumnBlockEntries(columnsWithFourOrMoreEqualWhiteRunLengths);
  console.log(blockEntries);

  return blockEntries;
}

const getWordleGridDataFromBlockEntries = (blockEntries: RowBlockEntry[], columnBlockEntries: ColumnBlockEntry[]): WordleGridData => {

  // build a data structure that maps the delta between a block's y position and another block's y position and the number
  // of block entries that have that delta.
  const rowDeltaCountsByRowDelta: any = {};
  let ii = 0;
  while (ii < (blockEntries.length - 1)) {
    let jj = ii + 1;
    while (jj < blockEntries.length) {
      const rowDelta = blockEntries[jj].imageFileRowIndex - blockEntries[ii].imageFileRowIndex;
      if (!rowDeltaCountsByRowDelta.hasOwnProperty(rowDelta)) {
        rowDeltaCountsByRowDelta[rowDelta] = 0;
      }
      rowDeltaCountsByRowDelta[rowDelta]++;
      jj++;
    }
    ii++;
  }

  console.log(rowDeltaCountsByRowDelta);

  // iterate through the deltas rowDeltaCountsByRowDelta; sum the counts for the keys that are 'adjacent'
  // find the one where the sum is 5 (NOTE - this doesn't always work)
  // other ways to verify this
  //    look at column info as well
  //    ensure that there are full white lines between the block entries?

  let lastRowDelta = -9999;
  let lastRowDeltaCount = -9999;

  let imageFileRowIndices: number[] = [];

  let whiteRunLength = -1;

  for (const rowDelta in rowDeltaCountsByRowDelta) {
    if (Object.prototype.hasOwnProperty.call(rowDeltaCountsByRowDelta, rowDelta)) {
      const rowDeltaAsNumber = parseInt(rowDelta, 10);
      const rowDeltaCount = rowDeltaCountsByRowDelta[rowDelta];
      if (rowDeltaCount === 5) {
        // this is the case where there is a single delta with 5 instances
        // I want the rows that correspond to this rowDelta - if this isn't unique, flag it
        if (imageFileRowIndices.length > 0) {
          console.log('FAILBLOG');
        }
        const wordleGridData = getWordleGridDataForRowDeltaCount(blockEntries, rowDeltaAsNumber);
        imageFileRowIndices = wordleGridData.imageFileRowIndices;
        whiteRunLength = wordleGridData.whiteRunLength;
      } else if ((rowDeltaAsNumber - lastRowDelta === 1)) {
        if ((rowDeltaCount + lastRowDeltaCount) === 5) {
          // this is the case where there are 5 instances of the deltaValue and the deltaValue +/- 1
          // I want the rows that correspond to this rowDelta && lastRowDelta
          if (imageFileRowIndices.length > 0) {
            console.log('FAILBLOG');
          }
          const wordleGridDataForLastRowDelta = getWordleGridDataForRowDeltaCount(blockEntries, lastRowDelta);
          const lastImageFileRowIndices = wordleGridDataForLastRowDelta.imageFileRowIndices;
          whiteRunLength = wordleGridDataForLastRowDelta.whiteRunLength;  // TEDTODO - why this run length and not next
          const wordleGridDataForNextRow = getWordleGridDataForRowDeltaCount(blockEntries, rowDeltaAsNumber);
          const nextImageFileRowIndices = wordleGridDataForNextRow.imageFileRowIndices;
          imageFileRowIndices = lastImageFileRowIndices.concat(nextImageFileRowIndices);
        }
      }

      lastRowDelta = rowDeltaAsNumber;
      lastRowDeltaCount = rowDeltaCount;
    }
  }

  return {
    imageFileRowIndices,
    whiteRunLength
  };

}

const getWordleGridDataForRowDeltaCount = (blockEntries: RowBlockEntry[], specifiedRowDelta: number): WordleGridData => {

  const imageFileRowIndices: number[] = [];
  let whiteRunLength: number = -1;

  let ii = 0;
  while (ii < (blockEntries.length - 1)) {
    let jj = ii + 1;
    while (jj < blockEntries.length) {
      const rowDelta = blockEntries[jj].imageFileRowIndex - blockEntries[ii].imageFileRowIndex;
      if (rowDelta === specifiedRowDelta) {
        imageFileRowIndices.push(blockEntries[ii].imageFileRowIndex);
        whiteRunLength = blockEntries[ii].whiteRunLength;
      }
      jj++;
    }
    ii++;
  }

  return { imageFileRowIndices, whiteRunLength };
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

