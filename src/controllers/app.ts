import { Request, response, Response } from 'express';
const en = require('dictionary-en');
import * as fs from 'fs';
import * as tmp from 'tmp';
import multer from 'multer';

import { isBoolean, isNil } from 'lodash';

import { version } from '../version';

let spellchecker: { parse: (arg0: { aff: Buffer; dic: Buffer; }) => any; use: (arg0: any) => void; check: (arg0: string) => any; };

import * as vision from '@google-cloud/vision';
import { PNGWithMetadata } from 'pngjs';
import { InWordAtExactLocationValue, InWordAtNonLocationValue, LetterAnswerType, NotInWordValue } from '../types';

const PNG = require('pngjs').PNG;

async function visionTest() {

  // Creates a client
  const client = new vision.ImageAnnotatorClient();

  /**
   * TODO(developer): Uncomment the following line before running the sample.
   */
  const fileName = '/Users/tedshaffer/Documents/Projects/twordleNerdleClient/programmaticallyGenerated-0.png';

  // Performs text detection on the local file
  const [result] = await client.textDetection(fileName);
  const detections: any[] = result.textAnnotations;
  console.log('Text:');
  detections.forEach(text => console.log(text));
}

interface TwordleSymbol extends vision.protos.google.cloud.vision.v1.ISymbol {
  rowIndex: number,
  useSymbol: boolean;
};

type symbolArray = TwordleSymbol[];

export interface overlapGroupMap {
  [id: number]: number[]; // index to array of indices
}

type point = [number, number];

function rectanglesOverlap(topLeft1: point, bottomRight1: point, topLeft2: point, bottomRight2: point) {
  if (topLeft1[0] > bottomRight2[0] || topLeft2[0] > bottomRight1[0]) {
    return false;
  }
  if (topLeft1[1] > bottomRight2[1] || topLeft2[1] > bottomRight1[1]) {
    return false;
  }
  return true;
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

export const getGuesses = (request: Request, response: Response, next: any) => {

  console.log('getGuesses');

  const { imageDataBase64 } = request.body;

  base64ToImg(imageDataBase64).then((filePath) => {
    textFromImage(response, filePath);
  });

}

async function textFromImage(response: Response, fileName: string) {

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
    // numberOfRows = blocks.length;
    // rowHeight = Math.trunc(imageHeight / numberOfRows);
    if (blocks.length > 1) {
      console.log('****** Number of blocks = ', blocks.length, ' ******');
    }
    // blocks.forEach((block: vision.protos.google.cloud.vision.v1.IBlock, rowIndex) => {
    blocks.forEach((block: vision.protos.google.cloud.vision.v1.IBlock) => {
      const paragraphs: vision.protos.google.cloud.vision.v1.IParagraph[] = block.paragraphs;
      numberOfRows = paragraphs.length;
      rowHeight = Math.trunc(imageHeight / numberOfRows);
      paragraphs.forEach((paragraph, rowIndex) => {
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
        console.log('rectangles overlap: ', symbolIndex, otherSymbolIndex);

        if (!rectangleOverlaps[otherSymbolIndex]) {
          if (!rectangleOverlapsGroups.hasOwnProperty(symbolIndex)) {
            rectangleOverlapsGroups[symbolIndex] = [];
          }
          rectangleOverlapsGroups[symbolIndex].push(otherSymbolIndex);
        }

        rectangleOverlaps[symbolIndex] = true;
        rectangleOverlaps[otherSymbolIndex] = true;

        console.log(symbol);
        console.log(otherSymbol);
        console.log(symbol.boundingBox.vertices);
        console.log(otherSymbol.boundingBox.vertices);
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
      console.log(rectangleIndex, baseSymbols[rectangleIndex].text, baseSymbols[rectangleIndex].boundingBox.vertices);
      (baseSymbols[rectangleIndex] as TwordleSymbol).useSymbol = true;
      // console.log(baseSymbols[rectangleIndex].text);
      // console.log(baseSymbols[rectangleIndex]);
      // console.log(baseSymbols[rectangleIndex].boundingBox.vertices);
    }
  }

  for (let rectangleIndex = 0; rectangleIndex < baseSymbols.length; rectangleIndex++) {
    if (!rectangleOverlaps[rectangleIndex]) {
      console.log(rectangleIndex, baseSymbols[rectangleIndex].text, baseSymbols[rectangleIndex].boundingBox.vertices);
      (baseSymbols[rectangleIndex] as TwordleSymbol).useSymbol = true;
      // console.log(baseSymbols[rectangleIndex].text);
      // console.log(baseSymbols[rectangleIndex]);
      // console.log(baseSymbols[rectangleIndex].boundingBox.vertices);
    }
  }

  console.log('Overlap');

  for (const baseSymbolIndex in rectangleOverlapsGroups) {
    const baseIndex = parseInt(baseSymbolIndex, 10);

    if (Object.prototype.hasOwnProperty.call(rectangleOverlapsGroups, baseSymbolIndex)) {
      const baseSymbol: vision.protos.google.cloud.vision.v1.ISymbol = baseSymbols[baseIndex];
      const baseConfidence = baseSymbol.confidence;

      let highestConfidenceIndex = baseIndex;
      let highestConfidence = baseConfidence;

      if (baseIndex === 9) {
        console.log('baseIndex 9', baseSymbol);
      }

      const rectangleOverlapsGroup: number[] = rectangleOverlapsGroups[baseSymbolIndex];
      for (let index = 0; index < rectangleOverlapsGroup.length; index++) {
        const overlappedRectangleIndex: number = rectangleOverlapsGroup[index];
        const overlappedSymbol: vision.protos.google.cloud.vision.v1.ISymbol = baseSymbols[overlappedRectangleIndex];
        const overlappedConfidence = overlappedSymbol.confidence;

        if (overlappedRectangleIndex === 14) {
          console.log('overlappedRectangleIndex 14', overlappedSymbol);
        }

        if (overlappedConfidence > highestConfidence) {
          highestConfidenceIndex = overlappedRectangleIndex;
          highestConfidence = overlappedConfidence;
        }
      }
      console.log(highestConfidenceIndex, baseSymbols[highestConfidenceIndex].text, baseSymbols[highestConfidenceIndex].boundingBox.vertices);
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
    console.log('Row ', rowIndex, symbolRow);
    symbolRow.sort((a: TwordleSymbol, b: TwordleSymbol) => {
      if (a.boundingBox.vertices[0].x < b.boundingBox.vertices[0].x) {
        return -1;
      } else if (a.boundingBox.vertices[0].x > b.boundingBox.vertices[0].x) {
        return 1;
      } return 0;
    })
  });

  const guesses: string[] = [];

  console.log('after sort');
  allSymbolRows.forEach((symbolRow, rowIndex) => {
    guesses.push('');
    symbolRow.forEach((symbol) => {
      guesses[rowIndex] += symbol.text;
      console.log(symbol.rowIndex, symbol.text, symbol.boundingBox.vertices);
    })
  });

  const data: any = {
    guesses,
  };

  console.log('send response');
  console.log(data);

  response.json(data);
}


const base64ToImg = (img: string): Promise<string> => {

  // string generated by canvas.toDataURL()
  // var img = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0'
  //   + 'NAAAAKElEQVQ4jWNgYGD4Twzu6FhFFGYYNXDUwGFpIAk2E4dHDRw1cDgaCAASFOffhEIO'
  //   + '3gAAAABJRU5ErkJggg==';
  // strip off the data: url prefix to get just the base64-encoded bytes
  var data = img.replace(/^data:image\/\w+;base64,/, '');
  var buf = new Buffer(data, 'base64');
  return new Promise((resolve, reject) => {

    const tmpobj = tmp.fileSync();
    console.log('File: ', tmpobj.name);
    console.log('Filedescriptor: ', tmpobj.fd);
    fs.write(tmpobj.fd, buf, (err) => {
      console.log('fs.write callback');
      if (err) {
        console.log('write error', err);
        return reject(err);
      }
      fs.close(tmpobj.fd, (err) => {
        if (err) {
          console.log('close error', err);
          return reject(err);
        }
        return resolve(tmpobj.name);
      });
    });
  });

}

export const getWords = (request: Request, response: Response, next: any) => {
  console.log('getWords');
  console.log(request.body);

  const { candidateLettersAtLocation, lettersSomewhereInWord } = request.body;

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

  response.status(200).json({
    success: true,
    words,
  });
};

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
    pngTest(request.file.path);
    return response.status(200).send(request.file);
  });
}

const pngTest = (path: string) => {

  var data = fs.readFileSync(path);
  // var png: PNGWithMetadata = PNG.sync.read(data);
  const png: PNGWithMetadata = PNG.sync.read(data, {
    filterType: -1,
  });
  console.log('png parsed');
  console.log(png.width);
  console.log(png.height);

  getGuessesFromUploadedFile(png.width, png.height, png.data);

  const buffer = PNG.sync.write(png);
  fs.writeFileSync('out-2.png', buffer);

  // for (let rowIndex = 0; rowIndex < png.height; rowIndex++) {
  //   for (let columnIndex = 0; columnIndex < png.width; columnIndex++) {
  //     let idx = (png.width * rowIndex + columnIndex) << 2;
  //   }
  // }

  // const valueCountByValue: any = {};

  // for (let rowIndex = 0; rowIndex < png.height; rowIndex++) {
  //   for (let columnIndex = 0; columnIndex < png.width; columnIndex++) {
  //     let idx = (png.width * rowIndex + columnIndex) << 2;
  //     // console.log('idx: ', idx);
  //     // console.log(png.data[idx], png.data[idx+1], png.data[idx+2], png.data[idx+3]);
  //     const value = png.data[idx].toString() + png.data[idx+1].toString() + png.data[idx+2].toString();
  //     if (valueCountByValue.hasOwnProperty(value)) {
  //       valueCountByValue[value] = valueCountByValue[value] + 1;
  //     } else {
  //       valueCountByValue[value] = 1;
  //     }
  //   }
  // }

  // console.log('done');

  // for (let y = 0; y < png.height; y++) {
  //   for (let x = 0; x < png.width; x++) {
  //     let idx = (png.width * y + x) << 2;

  //     if (
  //       Math.abs(png.data[idx] - png.data[idx + 1]) <= 1 &&
  //       Math.abs(png.data[idx + 1] - png.data[idx + 2]) <= 1
  //     )
  //       png.data[idx] = png.data[idx + 1] = png.data[idx + 2];
  //   }
  // }
  // var buffer = PNG.sync.write(png);
  // fs.writeFileSync('out.png', buffer);
}

const getGuessesFromUploadedFile = (imageWidth: number, imageHeight: number, data: Buffer) => {
  // console.log(data);

  // each value in data is a number <= 255
  const whiteAtImageDataRGBIndex: boolean[] = buildWhiteAtImageDataRGBIndex(data as unknown as Uint8ClampedArray);
  const whiteRows: number[] = getWhiteRows(imageWidth, whiteAtImageDataRGBIndex);
  const whiteColumns: number[] = getWhiteColumns(imageWidth, imageHeight, whiteAtImageDataRGBIndex);
  convertWhiteRowsToBlack(imageWidth, whiteRows, data as unknown as Uint8ClampedArray);
  convertWhiteColumnsToBlack(imageWidth, imageHeight, whiteColumns, data as unknown as Uint8ClampedArray);
  convertBackgroundColorsToBlack(data as unknown as Uint8ClampedArray);

  // console.log(whiteAtImageDataRGBIndex);
}

export const buildWhiteAtImageDataRGBIndex = (imageDataRGB: Uint8ClampedArray): boolean[] => {

  const whiteValue = 255;

  const whiteAtImageDataRGBIndex: boolean[] = [];

  for (let imageDataIndex = 0; imageDataIndex < imageDataRGB.length; imageDataIndex += 4) {
    const red = imageDataRGB[imageDataIndex];
    const green = imageDataRGB[imageDataIndex + 1];
    const blue = imageDataRGB[imageDataIndex + 2];
    if (red === whiteValue && green == whiteValue && blue === whiteValue) {
      whiteAtImageDataRGBIndex.push(true);
    } else {
      whiteAtImageDataRGBIndex.push(false);
    }
  }
  return whiteAtImageDataRGBIndex;
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

export const convertWhiteRowsToBlack = (canvasWidth: number, whiteRows: number[], imageDataRGB: Uint8ClampedArray) => {
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

export const convertWhiteColumnsToBlack = (canvasWidth: number, canvasHeight: number, whiteColumns: number[], imageDataRGB: Uint8ClampedArray) => {
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

export const convertBackgroundColorsToBlack = (imgData: Uint8ClampedArray) => {
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


const getLetterAnswerTypeRgb = (red: any, green: any, blue: any): LetterAnswerType => {
  if (isLetterAtExactLocation(red, green, blue)) {
    return LetterAnswerType.InWordAtExactLocation;
  } else if (isLetterNotAtExactLocation(red, green, blue)) {
    return LetterAnswerType.InWordAtNonLocation;
  } else if (isLetterNotInWord(red, green, blue)) {
    return LetterAnswerType.NotInWord;
    // } else if (!isLetterWhite(red, green, blue)) {
    //   console.log('letter unknown but not white: ', red, green, blue);
  }
  return LetterAnswerType.Unknown;
};

const acceptableColorValueDifference = 2;

const colorMatch = (actualColor: number, targetColor: number): boolean => {
  return (Math.abs(actualColor - targetColor) < acceptableColorValueDifference);
};

const isLetterAtExactLocation = (red: any, green: any, blue: any): boolean => {
  return (colorMatch(red, InWordAtExactLocationValue.red) && colorMatch(green, InWordAtExactLocationValue.green) && colorMatch(blue, InWordAtExactLocationValue.blue));
};

const isLetterNotAtExactLocation = (red: any, green: any, blue: any): boolean => {
  return (colorMatch(red, InWordAtNonLocationValue.red) && colorMatch(green, InWordAtNonLocationValue.green) && colorMatch(blue, InWordAtNonLocationValue.blue));
};

const isLetterNotInWord = (red: any, green: any, blue: any): boolean => {
  return (colorMatch(red, NotInWordValue.red) && colorMatch(green, NotInWordValue.green) && colorMatch(blue, NotInWordValue.blue));
};

