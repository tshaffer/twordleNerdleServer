import * as fs from 'fs';
import { PNGWithMetadata } from 'pngjs';
const PNG = require('pngjs').PNG;

import { ContentIndices, ContentIndicesByDirection, LetterAnswerType, point } from '../types';
import { buildIsWhiteAtImageDataRGBIndex, isLetterAtExactLocation, isLetterNotAtExactLocation, isLetterNotInWord, getWhiteRows, getWhiteColumns } from '../utilities';

export const analyzeImageFile = (path: string): ContentIndicesByDirection => {

  var data: Buffer = fs.readFileSync(path);
  const png: PNGWithMetadata = PNG.sync.read(data, {
    filterType: -1,
  });
  console.log('png parsed');
  console.log(png.width);
  console.log(png.height);

  const imageWidth = png.width;
  const imageHeight = png.height;

  const whiteAtImageDataRGBIndex: boolean[] = buildIsWhiteAtImageDataRGBIndex(png.data as unknown as Uint8ClampedArray);
  const whiteRows: number[] = getWhiteRows(imageWidth, whiteAtImageDataRGBIndex);
  const whiteColumns: number[] = getWhiteColumns(imageWidth, imageHeight, whiteAtImageDataRGBIndex);

  console.log('whiteRows: ', whiteRows);
  console.log('whiteColumns: ', whiteColumns);

  const contentRowIndices: ContentIndices = getContentRowIndices(whiteRows);
  console.log('contentRowIndices: ', contentRowIndices);

  const contentColumnIndices: ContentIndices = getContentColumnIndices(whiteColumns);
  console.log('contentColumnIndices: ', contentColumnIndices);

  if (whiteRows[0] !== 0) {
    contentRowIndices.startIndices.unshift(0);
    contentRowIndices.endIndices.unshift(whiteRows[0] - 1);
  }

  if (whiteColumns[0] !== 0) {
    contentColumnIndices.startIndices.unshift(0);
    contentColumnIndices.endIndices.unshift(whiteColumns[0] - 1);
  }

  return { contentRowIndices, contentColumnIndices };
}

const getContentRowIndices = (whiteRows: number[]): ContentIndices => {

  const dividerSize = 12;

  const rowDividerIndices: number[] = [];
  const contentRowStartIndices: number[] = [];
  const contentRowEndIndices: number[] = [];

  let whiteRowIndex = 1;
  let indexOfStartOfWhiteRows = 0;
  while (whiteRowIndex < whiteRows.length) {
    if (whiteRows[whiteRowIndex - 1] === (whiteRows[whiteRowIndex] - 1)) {
      if ((whiteRowIndex - indexOfStartOfWhiteRows + 1) === dividerSize) {
        rowDividerIndices.push(indexOfStartOfWhiteRows);
      }
    } else {
      indexOfStartOfWhiteRows = whiteRowIndex;
      const rowIndexOfStartOfContent = whiteRows[whiteRowIndex - 1] + 1;
      contentRowStartIndices.push(rowIndexOfStartOfContent);
      const rowIndexOfEndOfContent = whiteRows[whiteRowIndex] - 1;
      contentRowEndIndices.push(rowIndexOfEndOfContent);
    }
    whiteRowIndex++;
  }

  return {
    startIndices: contentRowStartIndices,
    endIndices: contentRowEndIndices,
  };
}

const getContentColumnIndices = (whiteColumns: number[]): ContentIndices => {

  const dividerSize = 12;

  const columnDividerIndices: number[] = [];
  const contentColumnStartIndices: number[] = [];
  const contentColumnEndIndices: number[] = [];

  let whiteColumnIndex = 1;
  let indexOfStartOfWhiteColumns = 0;
  while (whiteColumnIndex < whiteColumns.length) {
    if (whiteColumns[whiteColumnIndex - 1] === (whiteColumns[whiteColumnIndex] - 1)) {
      if ((whiteColumnIndex - indexOfStartOfWhiteColumns + 1) === dividerSize) {
        columnDividerIndices.push(indexOfStartOfWhiteColumns);
      }
    } else {
      indexOfStartOfWhiteColumns = whiteColumnIndex;
      const columnIndexOfStartOfContent = whiteColumns[whiteColumnIndex - 1] + 1;
      contentColumnStartIndices.push(columnIndexOfStartOfContent);
      const columnIndexOfEndOfContent = whiteColumns[whiteColumnIndex] - 1;
      contentColumnEndIndices.push(columnIndexOfEndOfContent);
    }
    whiteColumnIndex++;
  }

  return {
    startIndices: contentColumnStartIndices,
    endIndices: contentColumnEndIndices,
  };
}

