import { Request, Response } from 'express';
import * as fs from 'fs';
import multer from 'multer';
import { PNGWithMetadata } from 'pngjs';
const PNG = require('pngjs').PNG;

import { isNil } from 'lodash';

import { version } from '../version';

let spellchecker: { parse: (arg0: { aff: Buffer; dic: Buffer; }) => any; use: (arg0: any) => void; check: (arg0: string) => any; };

import { ContentIndices, ContentIndicesByDirection, LetterAnswerType, point } from '../types';
import { buildIsWhiteAtImageDataRGBIndex, isLetterAtExactLocation, isLetterNotAtExactLocation, isLetterNotInWord, getWhiteRows, getWhiteColumns } from '../utilities';
import { generateImageForOCR } from './fileAnalyzer';
import { getTextFromImage } from './ocr';


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

    generateImageForOCR(request.file.path);
    getTextFromImage().then((guessesObj: any) => {
      const responseData = {
        guesses: guessesObj,
        file: request.file,
      };
      return response.status(200).send(responseData);
    });
  });
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