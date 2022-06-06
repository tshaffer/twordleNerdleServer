import { Request, Response } from 'express';
import * as fs from 'fs';
import multer from 'multer';

import { isBoolean, isNil } from 'lodash';

import { version } from '../version';

let spellchecker: { parse: (arg0: { aff: Buffer; dic: Buffer; }) => any; use: (arg0: any) => void; check: (arg0: string) => any; };

import * as vision from '@google-cloud/vision';
import { PNGWithMetadata } from 'pngjs';
import { ContentIndices, ContentIndicesByDirection, LetterAnswerType, point } from '../types';
import { rectanglesOverlap, isColorGreenish, isColorGoldish, isColorGrayish, isColorWhitish } from '../utilities';

const PNG = require('pngjs').PNG;

interface TwordleSymbol extends vision.protos.google.cloud.vision.v1.ISymbol {
  rowIndex: number,
  useSymbol: boolean;
};

type symbolArray = TwordleSymbol[];

export interface overlapGroupMap {
  [id: number]: number[]; // index to array of indices
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
  rowIndex: number;
  runLength: number;
}

interface BlockEntry {
  imageFileRowIndex: number;
  indexOfBlockStart: number;
  blockLength: number;
  whiteRunLength: number;
}

interface WordleGridData {
  imageFileRowIndices: number[],
  whiteRunLength: number,
}

interface NumberByNumberLUT {
  [id: number]: number;
}

export const initializeSpellChecker = () => {

  // https://www.npmjs.com/package/hunspell-spellchecker
  const Spellchecker = require('hunspell-spellchecker');
  spellchecker = new Spellchecker();

  // Parse an hunspell dictionary that can be serialized as JSON
  const DICT = spellchecker.parse({
    aff: fs.readFileSync('./node_modules/dictionary-en/index.aff'),
    dic: fs.readFileSync('./node_modules/dictionary-en/index.dic')
  });

  // Load a dictionary
  spellchecker.use(DICT);

  // en(function (err: any, result: any) {
  //   console.log(err || result);
  // });
};

export const getVersion = (request: Request, response: Response, next: any) => {
  console.log('getVersion');
  const data: any = {
    serverVersion: version,
  };
  response.json(data);
};

async function textFromImage(fileName: string) {

  console.log('textFromImage');

  let imageWidth;
  let imageHeight: number;
  let rowHeight;
  let numberOfRows = 0;

  const client = new vision.ImageAnnotatorClient();

  // Read a local image as a text document
  const [result]: vision.protos.google.cloud.vision.v1.IAnnotateImageResponse[] = await client.documentTextDetection(fileName);
  const fullTextAnnotation: vision.protos.google.cloud.vision.v1.ITextAnnotation = result.fullTextAnnotation;

  const pages: vision.protos.google.cloud.vision.v1.IPage[] = fullTextAnnotation.pages;
  const baseSymbols: vision.protos.google.cloud.vision.v1.ISymbol[] = [];

  pages.forEach((page: vision.protos.google.cloud.vision.v1.IPage) => {

    imageWidth = page.width;
    imageHeight = page.height;

    const blocks: vision.protos.google.cloud.vision.v1.IBlock[] = page.blocks;
    if (blocks.length > 1) {
      console.log('****** Number of blocks = ', blocks.length, ' ******');
    }
    numberOfRows = blocks.length;
    rowHeight = Math.trunc(imageHeight / numberOfRows);
    blocks.forEach((block: vision.protos.google.cloud.vision.v1.IBlock, rowIndex) => {
      const paragraphs: vision.protos.google.cloud.vision.v1.IParagraph[] = block.paragraphs;
      paragraphs.forEach((paragraph) => {
        const words: vision.protos.google.cloud.vision.v1.IWord[] = paragraph.words;
        words.forEach(word => {
          const symbols: vision.protos.google.cloud.vision.v1.ISymbol[] = word.symbols;
          symbols.forEach((symbol: vision.protos.google.cloud.vision.v1.ISymbol) => {
            (symbol as TwordleSymbol).rowIndex = rowIndex;
            baseSymbols.push(symbol);
          });
        });
      });
    });
    // blocks.forEach((block: vision.protos.google.cloud.vision.v1.IBlock) => {
    //   const paragraphs: vision.protos.google.cloud.vision.v1.IParagraph[] = block.paragraphs;
    //   numberOfRows = paragraphs.length;
    //   rowHeight = Math.trunc(imageHeight / numberOfRows);
    //   paragraphs.forEach((paragraph, rowIndex) => {
    //     const words: vision.protos.google.cloud.vision.v1.IWord[] = paragraph.words;
    //     words.forEach(word => {
    //       const symbols: vision.protos.google.cloud.vision.v1.ISymbol[] = word.symbols;
    //       symbols.forEach((symbol: vision.protos.google.cloud.vision.v1.ISymbol) => {
    //         (symbol as TwordleSymbol).rowIndex = rowIndex;
    //         baseSymbols.push(symbol);
    //       });
    //     });
    //   });
    // });
  });

  const rectangleOverlaps: boolean[] = [];

  for (let rectangleIndex = 0; rectangleIndex < baseSymbols.length; rectangleIndex++) {
    rectangleOverlaps.push(false);
  }

  const rectangleOverlapsGroups: overlapGroupMap = {};

  for (let symbolIndex = 0; symbolIndex < baseSymbols.length; symbolIndex++) {
    const symbol: vision.protos.google.cloud.vision.v1.ISymbol = baseSymbols[symbolIndex];
    const symbolBoundingBox: vision.protos.google.cloud.vision.v1.IBoundingPoly = symbol.boundingBox;
    const symbolVertices = symbolBoundingBox.vertices;

    const topLeft1: point = [symbolVertices[0].x, symbolVertices[0].y];
    const bottomRight1: point = [symbolVertices[2].x, symbolVertices[2].y];

    let otherSymbolIndex = symbolIndex + 1;
    while (otherSymbolIndex < baseSymbols.length) {
      const otherSymbol: vision.protos.google.cloud.vision.v1.ISymbol = baseSymbols[otherSymbolIndex];
      const otherSymbolBoundingBox: vision.protos.google.cloud.vision.v1.IBoundingPoly = otherSymbol.boundingBox;
      const otherSymbolVertices = otherSymbolBoundingBox.vertices;

      const topLeft2: point = [otherSymbolVertices[0].x, otherSymbolVertices[0].y];
      const bottomRight2: point = [otherSymbolVertices[2].x, otherSymbolVertices[2].y];

      const overlap: boolean = rectanglesOverlap(topLeft1, bottomRight1, topLeft2, bottomRight2);
      if (overlap) {
        // console.log('rectangles overlap: ', symbolIndex, otherSymbolIndex);

        if (!rectangleOverlaps[otherSymbolIndex]) {
          if (!rectangleOverlapsGroups.hasOwnProperty(symbolIndex)) {
            rectangleOverlapsGroups[symbolIndex] = [];
          }
          rectangleOverlapsGroups[symbolIndex].push(otherSymbolIndex);
        }

        rectangleOverlaps[symbolIndex] = true;
        rectangleOverlaps[otherSymbolIndex] = true;

        // console.log(symbol);
        // console.log(otherSymbol);
        // console.log(symbol.boundingBox.vertices);
        // console.log(otherSymbol.boundingBox.vertices);
      }
      otherSymbolIndex++;
    }
  }

  let nonOverlappingSymbolsCount = 0;
  for (let rectangleIndex = 0; rectangleIndex < baseSymbols.length; rectangleIndex++) {
    if (!rectangleOverlaps[rectangleIndex]) {
      nonOverlappingSymbolsCount++;
    }
  }

  for (let rectangleIndex = 0; rectangleIndex < baseSymbols.length; rectangleIndex++) {
    if (!rectangleOverlaps[rectangleIndex]) {
      // console.log(rectangleIndex, baseSymbols[rectangleIndex].text, baseSymbols[rectangleIndex].boundingBox.vertices);
      (baseSymbols[rectangleIndex] as TwordleSymbol).useSymbol = true;
      // console.log(baseSymbols[rectangleIndex].text);
      // console.log(baseSymbols[rectangleIndex]);
      // console.log(baseSymbols[rectangleIndex].boundingBox.vertices);
    }
  }

  for (let rectangleIndex = 0; rectangleIndex < baseSymbols.length; rectangleIndex++) {
    if (!rectangleOverlaps[rectangleIndex]) {
      // console.log(rectangleIndex, baseSymbols[rectangleIndex].text, baseSymbols[rectangleIndex].boundingBox.vertices);
      (baseSymbols[rectangleIndex] as TwordleSymbol).useSymbol = true;
      // console.log(baseSymbols[rectangleIndex].text);
      // console.log(baseSymbols[rectangleIndex]);
      // console.log(baseSymbols[rectangleIndex].boundingBox.vertices);
    }
  }

  // console.log('Overlap');

  for (const baseSymbolIndex in rectangleOverlapsGroups) {
    const baseIndex = parseInt(baseSymbolIndex, 10);

    if (Object.prototype.hasOwnProperty.call(rectangleOverlapsGroups, baseSymbolIndex)) {
      const baseSymbol: vision.protos.google.cloud.vision.v1.ISymbol = baseSymbols[baseIndex];
      const baseConfidence = baseSymbol.confidence;

      let highestConfidenceIndex = baseIndex;
      let highestConfidence = baseConfidence;

      const rectangleOverlapsGroup: number[] = rectangleOverlapsGroups[baseSymbolIndex];
      for (let index = 0; index < rectangleOverlapsGroup.length; index++) {
        const overlappedRectangleIndex: number = rectangleOverlapsGroup[index];
        const overlappedSymbol: vision.protos.google.cloud.vision.v1.ISymbol = baseSymbols[overlappedRectangleIndex];
        const overlappedConfidence = overlappedSymbol.confidence;

        if (overlappedConfidence > highestConfidence) {
          highestConfidenceIndex = overlappedRectangleIndex;
          highestConfidence = overlappedConfidence;
        }
      }
      // console.log(highestConfidenceIndex, baseSymbols[highestConfidenceIndex].text, baseSymbols[highestConfidenceIndex].boundingBox.vertices);
      (baseSymbols[highestConfidenceIndex] as TwordleSymbol).useSymbol = true;

      // console.log(highestConfidence);
      // console.log(baseSymbols[highestConfidenceIndex].text);
    }

  }

  const allSymbolRows: symbolArray[] = [];

  for (let i = 0; i < numberOfRows; i++) {
    allSymbolRows.push([]);
  }
  baseSymbols.forEach((baseSymbol: TwordleSymbol) => {
    if (isBoolean(baseSymbol.useSymbol) && baseSymbol.useSymbol) {
      const symbolWidth = baseSymbol.boundingBox.vertices[1].x - baseSymbol.boundingBox.vertices[0].x;
      if (symbolWidth > 1) {
        const symbolRowIndex = baseSymbol.rowIndex;
        allSymbolRows[symbolRowIndex].push(baseSymbol);
      }
    }
  })

  allSymbolRows.forEach((symbolRow, rowIndex) => {
    // console.log('Row ', rowIndex, symbolRow);
    symbolRow.sort((a: TwordleSymbol, b: TwordleSymbol) => {
      if (a.boundingBox.vertices[0].x < b.boundingBox.vertices[0].x) {
        return -1;
      } else if (a.boundingBox.vertices[0].x > b.boundingBox.vertices[0].x) {
        return 1;
      } return 0;
    })
  });

  const guesses: string[] = [];

  // console.log('after sort');
  allSymbolRows.forEach((symbolRow, rowIndex) => {
    guesses.push('');
    symbolRow.forEach((symbol) => {
      guesses[rowIndex] += symbol.text;
      // console.log(symbol.rowIndex, symbol.text, symbol.boundingBox.vertices);
    })
  });

  const data: any = {
    guesses,
  };

  return data;

}

export const uploadFile = (request: Request, response: Response, next: any) => {

  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'public');
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + '-' + file.originalname);
    }
  });
  const upload = multer({ storage: storage }).single('file');
  upload(request, response, function (err) {
    if (err instanceof multer.MulterError) {
      return response.status(500).json(err);
    } else if (err) {
      return response.status(500).json(err);
    }
    console.log('return from upload: ', request.file);

    getTextUsingOCR(request.file.path).then((guessesObj: any) => {
      console.log('return from pngTest: ', guessesObj);
      const responseData = {
        guesses: guessesObj,
        file: request.file,
      };
      return response.status(200).send(responseData);
    });
  });
};

const getTextUsingOCR = (path: string): Promise<any> => {

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

  return textFromImage('wordleOut.png').then((data) => {
    console.log('data from textFromImage using wordleOut.png');
    console.log(data);

    return data;
  });
}

const getWordleGridData = (imageWidth: number, imageHeight: number, imageData: Buffer): WordleGridData => {
  const whiteRunsInRows: WhiteRunsInRow[] = buildWhiteRunsInRows(imageWidth, imageHeight, imageData);
  const wordleGridData: WordleGridData = processWhiteRunsInRows(whiteRunsInRows);
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

/*
interface WhiteRunsInRowWithEqualRunLengths {
  rowIndex: number;
  runLength: number;
}
*/
const buildRowsWithFourOrMoreEqualWhiteRunLengths = (whiteRunsInRows: WhiteRunsInRow[]): WhiteRunsInRowWithFourOrMoreEqualRunLengths[] => {

  const rowsWithFourOrMoreEqualWhiteRunLengths: WhiteRunsInRowWithFourOrMoreEqualRunLengths[] = [];

  let indexIntoRowsOfWhiteRuns = 0;

  for (const whiteRunsInRow of whiteRunsInRows) {
    // for this to be a row that might include a letter, it must have at least 6 white runs
    // one before the grid; four inside the grid; one after the grid
    // note - if the user has entered a character into a row, there will be additional white runs
    if (whiteRunsInRow.whiteRuns.length >= 6) {

      // check for instance(s) of 4 whiteRuns that have 'equivalent' length

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
              const lastPushedRowIndex = rowsWithFourOrMoreEqualWhiteRunLengths[lastIndex].rowIndex;
              const newRowIndex = whiteRunsInRow.imageFileRowIndex;
              if (newRowIndex > lastPushedRowIndex) {
                const rowWithFourOrMoreEqualRunLengths: WhiteRunsInRowWithFourOrMoreEqualRunLengths = {
                  rowIndex: whiteRunsInRow.imageFileRowIndex,
                  runLength: parseInt(runLength, 10),
                };
                rowsWithFourOrMoreEqualWhiteRunLengths.push(rowWithFourOrMoreEqualRunLengths);
              }
            } else {
              const rowWithFourOrMoreEqualRunLengths: WhiteRunsInRowWithFourOrMoreEqualRunLengths = {
                rowIndex: whiteRunsInRow.imageFileRowIndex,
                runLength: parseInt(runLength, 10),
              };
              rowsWithFourOrMoreEqualWhiteRunLengths.push(rowWithFourOrMoreEqualRunLengths);
            }
          }
        }
      }
    }

    indexIntoRowsOfWhiteRuns++;
  }

  return rowsWithFourOrMoreEqualWhiteRunLengths;
}

/*
  look for entries in rowsWithFourEqualWhiteRunLengths where the row index is one greater than the row index of the prior entry in rowsWithFourEqualWhiteRunLengths and one less than the row index of the next entry in rowsOfWhiteRunsFilter0.
  create a data structure to store these blocks with entries that match the above criteria
*/
const buildBlockEntries = (rowsWithFourOrMoreEqualWhiteRunLengths: WhiteRunsInRowWithFourOrMoreEqualRunLengths[]): BlockEntry[] => {

  const blockEntries: BlockEntry[] = [];

  let inBlock = false;
  let blockLength = 0;
  let indexOfBlockStart = 0;      // index into rowsWithFourOrMoreEqualWhiteRunLengths where block starts
  let imageFileRowIndex = 0;      // index into image data structure
  let whiteRunLength = -1;

  // special case first row
  const rowWithFourOrMoreEqualWhiteRunLengths: WhiteRunsInRowWithFourOrMoreEqualRunLengths = rowsWithFourOrMoreEqualWhiteRunLengths[0];
  const nextRowWithFourOrMoreEqualWhiteRunLengths: WhiteRunsInRowWithFourOrMoreEqualRunLengths = rowsWithFourOrMoreEqualWhiteRunLengths[1];
  if (rowWithFourOrMoreEqualWhiteRunLengths.rowIndex === (nextRowWithFourOrMoreEqualWhiteRunLengths.rowIndex - 1)) {
    inBlock = true;
    indexOfBlockStart = 0;
    blockLength = 1;
  }

  for (let index = 1; (index < rowsWithFourOrMoreEqualWhiteRunLengths.length - 1); index++) {

    const priorRowWithFourOrMoreEqualWhiteRunLengths: WhiteRunsInRowWithFourOrMoreEqualRunLengths = rowsWithFourOrMoreEqualWhiteRunLengths[index - 1];
    const rowWithFourOrMoreEqualWhiteRunLengths: WhiteRunsInRowWithFourOrMoreEqualRunLengths = rowsWithFourOrMoreEqualWhiteRunLengths[index];
    const nextRowWithFourOrMoreEqualWhiteRunLengths: WhiteRunsInRowWithFourOrMoreEqualRunLengths = rowsWithFourOrMoreEqualWhiteRunLengths[index + 1];

    if (rowWithFourOrMoreEqualWhiteRunLengths.rowIndex === (priorRowWithFourOrMoreEqualWhiteRunLengths.rowIndex + 1)
      && rowWithFourOrMoreEqualWhiteRunLengths.rowIndex === (nextRowWithFourOrMoreEqualWhiteRunLengths.rowIndex - 1)) {
      // in block
      if (!inBlock) {
        inBlock = true;
        indexOfBlockStart = index - 1;
        imageFileRowIndex = rowWithFourOrMoreEqualWhiteRunLengths.rowIndex;
        blockLength = 2;
        whiteRunLength = rowWithFourOrMoreEqualWhiteRunLengths.runLength;
      }
      blockLength++;

    } else {
      if (inBlock && blockLength >= 4) {
        const blockEntry: BlockEntry = {
          imageFileRowIndex,
          indexOfBlockStart,
          blockLength,
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

const processWhiteRunsInRows = (whiteRunsInRows: WhiteRunsInRow[]): WordleGridData => {

  const rowsWithFourOrMoreEqualWhiteRunLengths: WhiteRunsInRowWithFourOrMoreEqualRunLengths[] = buildRowsWithFourOrMoreEqualWhiteRunLengths(whiteRunsInRows);

  const blockEntries: BlockEntry[] = buildBlockEntries(rowsWithFourOrMoreEqualWhiteRunLengths);
  console.log(blockEntries);

  const wordleGridData: WordleGridData = getWordleGridDataFromBlockEntries(blockEntries);
  return wordleGridData;
}

const getWordleGridDataFromBlockEntries = (blockEntries: BlockEntry[]): WordleGridData => {

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

const getWordleGridDataForRowDeltaCount = (blockEntries: BlockEntry[], specifiedRowDelta: number): WordleGridData => {

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

const prepareImageForOCR = (imageWidth: number, imageHeight: number, data: Buffer) => {
  const whiteAtImageDataRGBIndex: boolean[] = buildIsWhiteAtImageDataRGBIndex(data as unknown as Uint8ClampedArray);
  const whiteRows: number[] = getWhiteRows(imageWidth, whiteAtImageDataRGBIndex);
  const whiteColumns: number[] = getWhiteColumns(imageWidth, imageHeight, whiteAtImageDataRGBIndex);
  convertWhiteRowsToBlack(imageWidth, whiteRows, data as unknown as Uint8ClampedArray);
  convertWhiteColumnsToBlack(imageWidth, imageHeight, whiteColumns, data as unknown as Uint8ClampedArray);
  convertBackgroundColorsToBlack(data);
}

const buildIsWhiteAtImageDataRGBIndex = (imageDataRGBA: Uint8ClampedArray): boolean[] => {

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

const getWhiteRows = (canvasWidth: number, whiteAtImageDataRGBIndex: boolean[]): number[] => {

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

const getWhiteColumns = (canvasWidth: number, canvasHeight: number, whiteAtImageDataRGBIndex: boolean[]): number[] => {

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
  for (let i = 0; i < imgData.length; i += 4) {
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

const offsetFromPosition = (canvasWidth: number, row: number, column: number): number => {
  const offset = (row * canvasWidth * 4) + (column * 4);
  return offset;
};

const getLetterAnswerType = (imgData: ImageData): LetterAnswerType => {

  if (isLetterAtExactLocation(imgData.data[0], imgData.data[1], imgData.data[2])) {
    return LetterAnswerType.InWordAtExactLocation;
  } else if (isLetterNotAtExactLocation(imgData.data[0], imgData.data[1], imgData.data[2])) {
    return LetterAnswerType.InWordAtNonLocation;
  } else if (isLetterNotInWord(imgData.data[0], imgData.data[1], imgData.data[2])) {
    return LetterAnswerType.NotInWord;
    // } else if (!isLetterWhite(imgData.data[0], imgData.data[1], imgData.data[2])) {
    //   console.log('letter unknown but not white: ', imgData.data[0], imgData.data[1], imgData.data[2]);
  }
  return LetterAnswerType.Unknown;
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

const isLetterAtExactLocation = (red: any, green: any, blue: any): boolean => {
  return isColorGreenish(red, green, blue);
};

const isLetterNotAtExactLocation = (red: any, green: any, blue: any): boolean => {
  return isColorGoldish(red, green, blue);
};

const isLetterNotInWord = (red: any, green: any, blue: any): boolean => {
  return isColorGrayish(red, green, blue);
};

export const getWords = (request: Request, response: Response, next: any) => {

  // const { pathOnServer, guesses } = request.body;
  const { guesses } = request.body;
  const pathOnServer = 'public/croppedWordleOut.png';

  var data = fs.readFileSync(pathOnServer);

  const png: PNGWithMetadata = PNG.sync.read(data, {
    filterType: -1,
  });
  console.log('png parsed');
  console.log(png.width);
  console.log(png.height);

  const contentIndices: ContentIndicesByDirection = analyzeImageFile(pathOnServer);
  console.log('contentIndices', contentIndices);

  const letterAnswerTypes = getLetterTypes(guesses, png.data, png.width, contentIndices);

  const words = getWordsPrep(letterAnswerTypes);
  console.log('getWordsPrep - words = ', words);

  response.status(200).json({
    success: true,
    words,
  });

}

const getWordsPrep = (letterAnswerTypes: any) => {

  const candidateLettersAtLocation: string[][] = [];

  const { lettersAtExactLocation, lettersNotAtExactLocation, lettersNotInWord } = letterAnswerTypes;
  const arrayOfLettersNotInWord: string[] = lettersNotInWord.split('');

  for (let i = 0; i < 5; i++) {
    candidateLettersAtLocation[i] = [];

    // console.log('Candidate letters at location ' + i);

    // check to see if there's an exact letter at this location
    if (lettersAtExactLocation[i] !== '') {

      candidateLettersAtLocation[i].push(lettersAtExactLocation[i]);

      // console.log('Exact letter at location: ' + candidateLettersAtLocation[i]);

    } else {

      // initialize to include all characters
      for (let j = 0; j < 26; j++) {
        // candidateLettersAtLocation[i].push(String.fromCharCode(j + 97));
        candidateLettersAtLocation[i].push(String.fromCharCode(j + 65));
      }

      let candidateLettersAtThisLocation: string[] = candidateLettersAtLocation[i];

      // eliminate lettersNotInWord
      for (let j = 0; j < arrayOfLettersNotInWord.length; j++) {
        const letterNotInWord: string = arrayOfLettersNotInWord[j];
        candidateLettersAtThisLocation = candidateLettersAtThisLocation.filter(item => item !== letterNotInWord);
      }
      // console.log(candidateLettersAtThisLocation);


      // eliminate lettersNotAtExactLocation
      const lettersNotAtThisLocation: string = lettersNotAtExactLocation[i];
      if (!isNil(lettersNotAtThisLocation)) {
        const arrayOfLettersNotAtThisLocation: string[] = lettersNotAtThisLocation.split('');
        for (let j = 0; j < arrayOfLettersNotAtThisLocation.length; j++) {
          const letterNotAtThisLocation: string = arrayOfLettersNotAtThisLocation[j];
          candidateLettersAtThisLocation = candidateLettersAtThisLocation.filter(item => item !== letterNotAtThisLocation);
        }
      }
      console.log(candidateLettersAtThisLocation);

      candidateLettersAtLocation[i] = candidateLettersAtThisLocation;
    }
  }

  const lettersSomewhereInWord: string[] = [];
  lettersNotAtExactLocation.forEach((lettersNotAtThisLocation: string) => {
    if (!isNil(lettersNotAtThisLocation)) {
      const lettersNotAtThisLocationArray = lettersNotAtThisLocation.split('');
      if (!isNil(lettersNotAtThisLocationArray)) {
        lettersNotAtThisLocationArray.forEach((letterNotAtThisLocation: string) => {
          if (lettersSomewhereInWord.indexOf(letterNotAtThisLocation)) {
            lettersSomewhereInWord.push(letterNotAtThisLocation);
          }
        });
      }
    }
  });

  // candidateLettersAtLocation,
  // lettersSomewhereInWord,
  const words: string[] = [];

  for (let clalIndex0 = 0; clalIndex0 < candidateLettersAtLocation[0].length; clalIndex0++) {
    const clal0 = candidateLettersAtLocation[0][clalIndex0];
    for (let clalIndex1 = 0; clalIndex1 < candidateLettersAtLocation[1].length; clalIndex1++) {
      const clal1 = candidateLettersAtLocation[1][clalIndex1];
      for (let clalIndex2 = 0; clalIndex2 < candidateLettersAtLocation[2].length; clalIndex2++) {
        const clal2 = candidateLettersAtLocation[2][clalIndex2];
        for (let clalIndex3 = 0; clalIndex3 < candidateLettersAtLocation[3].length; clalIndex3++) {
          const clal3 = candidateLettersAtLocation[3][clalIndex3];
          for (let clalIndex4 = 0; clalIndex4 < candidateLettersAtLocation[4].length; clalIndex4++) {
            const clal4 = candidateLettersAtLocation[4][clalIndex4];

            const candidateWord: string = ((clal0 + clal1 + clal2 + clal3 + clal4) as string).toUpperCase();

            // console.log(candidateWord + candidateWord.length);

            // ensure that word contains all lettersNotAtExactLocation
            let allLettersSomewhereInWordAreInThisWord = true;
            const candidateWordAsArray = candidateWord.split('');
            for (const letterSomewhereInWord of lettersSomewhereInWord) {
              if (!isNil(letterSomewhereInWord)) {
                if (candidateWordAsArray.indexOf(letterSomewhereInWord) < 0) {
                  allLettersSomewhereInWordAreInThisWord = false;
                  break;
                }
              }
            }

            if (allLettersSomewhereInWordAreInThisWord) {
              const isWord = spellchecker.check(candidateWord);
              // console.log(candidateWord + ' ' + isWord);
              if (isWord) {
                words.push(candidateWord);
              }
            }
          }
        }
      }
    }
  }

  return words;
}

const analyzeImageFile = (path: string): ContentIndicesByDirection => {

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

const getLetterTypes = (guesses: string[], imageData: Buffer, imageWidth: number, contentIndicesByDirection: ContentIndicesByDirection) => {

  let lettersNotInWord: string = '';
  const letterAnswerValues: LetterAnswerType[][] = [];
  const lettersAtExactLocation: string[] = ['', '', '', '', ''];
  const lettersNotAtExactLocation: string[] = ['', '', '', '', ''];

  const numRows = contentIndicesByDirection.contentRowIndices.startIndices.length;
  const numColumns = contentIndicesByDirection.contentColumnIndices.startIndices.length;

  // for (let rowIndex = 0; rowIndex < numRows; rowIndex++) {
  for (let rowIndex = 0; rowIndex < guesses.length; rowIndex++) {
    letterAnswerValues.push([]);
    const letterAnswersInRow = letterAnswerValues[rowIndex];
    for (let columnIndex = 0; columnIndex < numColumns; columnIndex++) {
      const letterAnswerType: LetterAnswerType = getLetterAnswer(imageData, imageWidth, contentIndicesByDirection, rowIndex, columnIndex);
      console.log(rowIndex, columnIndex, letterAnswerType);

      letterAnswersInRow.push(letterAnswerType);

      const currentCharacter: string = guesses[rowIndex].charAt(columnIndex);

      console.log(rowIndex, columnIndex, currentCharacter, letterAnswerType);

      switch (letterAnswerType) {
        case LetterAnswerType.InWordAtExactLocation:
          lettersAtExactLocation[columnIndex] = currentCharacter;
          break;
        case LetterAnswerType.InWordAtNonLocation:
          lettersNotAtExactLocation[columnIndex] = lettersNotAtExactLocation[columnIndex] + currentCharacter;
          break;
        case LetterAnswerType.NotInWord:
        default:
          lettersNotInWord = lettersNotInWord + currentCharacter;
          break;
      }
    }
  }

  return {
    lettersAtExactLocation,
    lettersNotAtExactLocation,
    lettersNotInWord,
  };

}

const getLetterAnswer = (imageData: Buffer, imageWidth: number, contentIndicesByDirection: ContentIndicesByDirection, rowIndex: number, columnIndex: number): LetterAnswerType => {

  const rowDataIndex = contentIndicesByDirection.contentRowIndices.startIndices[rowIndex];
  const columnDataIndex = contentIndicesByDirection.contentColumnIndices.startIndices[columnIndex];

  const pixelIndex = (rowDataIndex * imageWidth) + columnDataIndex;
  const indexIntoBuffer = pixelIndex * 4;

  const data: Uint8ClampedArray = new Uint8ClampedArray(4);
  const imgData: ImageData = {
    data,
    height: 0,
    width: 0,
  }
  imgData.data[0] = imageData[indexIntoBuffer];
  imgData.data[1] = imageData[indexIntoBuffer + 1];
  imgData.data[2] = imageData[indexIntoBuffer + 2];
  imgData.data[3] = imageData[indexIntoBuffer + 3];

  const letterAnswerType: LetterAnswerType = getLetterAnswerType(imgData);

  return letterAnswerType;
}