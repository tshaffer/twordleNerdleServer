import { Request, Response } from 'express';
const en = require('dictionary-en');
import * as fs from 'fs';
import * as tmp from 'tmp';

import { isNil, join } from 'lodash';

import { version } from '../version';

let spellchecker: { parse: (arg0: { aff: Buffer; dic: Buffer; }) => any; use: (arg0: any) => void; check: (arg0: string) => any; };

import * as vision from '@google-cloud/vision'

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

// before
// https://cloud.google.com/vision/docs/samples/vision-fulltext-detection
async function visionTest2(fileName: string) {

  const client = new vision.ImageAnnotatorClient();

  // Read a local image as a text document
  const [result]: vision.protos.google.cloud.vision.v1.IAnnotateImageResponse[] = await client.documentTextDetection(fileName);

  // console.log('result keys: ', Object.keys(result));

  const fullTextAnnotation: vision.protos.google.cloud.vision.v1.ITextAnnotation = result.fullTextAnnotation;
  // console.log('fullTextAnnotation keys: ', Object.keys(fullTextAnnotation));
  // console.log(`Full text: ${fullTextAnnotation.text}`);

  // vision.protos.google.cloud.vision.v1.
  const pages: vision.protos.google.cloud.vision.v1.IPage[] = fullTextAnnotation.pages;
  // pages.forEach((page: vision.protos.google.cloud.vision.v1.IPage) => {
  //   // console.log('page keys: ', Object.keys(page));
  //   console.log('page width, height: ', page.width, page.height);
  //   // (fullTextAnnotation.pages as any).forEach(page: any => {
  //   const blocks: vision.protos.google.cloud.vision.v1.IBlock[] = page.blocks;
  //   blocks.forEach((block: vision.protos.google.cloud.vision.v1.IBlock) => {
  //     // console.log('block keys: ', Object.keys(block));
  //     // console.log(`Block confidence: ${block.confidence}`);
  //     // console.log('Block bounding box: ', block.boundingBox);
  //     const paragraphs: vision.protos.google.cloud.vision.v1.IParagraph[] = block.paragraphs;
  //     paragraphs.forEach(paragraph => {
  //       // console.log('paragraph keys: ', Object.keys(paragraph));
  //       // console.log(`Paragraph confidence: ${paragraph.confidence}`);
  //       const words: vision.protos.google.cloud.vision.v1.IWord[] = paragraph.words;
  //       words.forEach(word => {
  //         // console.log('word keys: ', Object.keys(word));
  //         const symbols: vision.protos.google.cloud.vision.v1.ISymbol[] = word.symbols;
  //         // const wordText = symbols.map(s => s.text).join('');
  //         // console.log(`Word text: ${wordText}`);
  //         // console.log(`Word confidence: ${word.confidence}`);
  //         symbols.forEach((symbol: vision.protos.google.cloud.vision.v1.ISymbol) => {
  //           // console.log('symbol keys: ', Object.keys(symbol));
  //           // console.log(`Symbol text: ${symbol.text}`);
  //           // console.log(`Symbol confidence: ${symbol.confidence}`);
  //           // console.log('Symbol bounding box: ', symbol.boundingBox);
  //         });
  //       });
  //     });
  //   });
  // });// end

  console.log('pages length: ', pages.length);

  // check for overlapping symbol rectangles
  const baseSymbols: vision.protos.google.cloud.vision.v1.ISymbol[] = [];
  pages.forEach((page: vision.protos.google.cloud.vision.v1.IPage) => {
    console.log('page width, height: ', page.width, page.height);
    const blocks: vision.protos.google.cloud.vision.v1.IBlock[] = page.blocks;
    blocks.forEach((block: vision.protos.google.cloud.vision.v1.IBlock) => {
      const paragraphs: vision.protos.google.cloud.vision.v1.IParagraph[] = block.paragraphs;
      paragraphs.forEach(paragraph => {
        const words: vision.protos.google.cloud.vision.v1.IWord[] = paragraph.words;
        words.forEach(word => {
          const symbols: vision.protos.google.cloud.vision.v1.ISymbol[] = word.symbols;
          symbols.forEach((symbol: vision.protos.google.cloud.vision.v1.ISymbol) => {
            console.log(`Symbol text: ${symbol.text}`);
            console.log(`Symbol confidence: ${symbol.confidence}`);
            console.log('Symbol bounding box: ', symbol.boundingBox);
            baseSymbols.push(symbol);
          });
        });
      });
    });
  });// end

  console.log('symbols length: ', baseSymbols.length);

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

  console.log('rectangleOverlapsGroups');
  console.log(rectangleOverlapsGroups);

  console.log('rectangleOverlaps');
  console.log(rectangleOverlaps);

  let nonOverlappingSymbolsCount = 0;
  console.log('non overlapping symbols');
  for (let rectangleIndex = 0; rectangleIndex < baseSymbols.length; rectangleIndex++) {
    if (!rectangleOverlaps[rectangleIndex]) {
      nonOverlappingSymbolsCount++;
    }
  }

  console.log('Number of rectangle overlap groups: ', Object.keys(rectangleOverlapsGroups).length);
  console.log('Number of non overlapping symbols: ', nonOverlappingSymbolsCount);

  // selected symbols
  console.log('SELECTED SYMBOLS');

  console.log('No overlap');
  for (let rectangleIndex = 0; rectangleIndex < baseSymbols.length; rectangleIndex++) {
    if (!rectangleOverlaps[rectangleIndex]) {
      console.log(rectangleIndex, baseSymbols[rectangleIndex].text, baseSymbols[rectangleIndex].boundingBox.vertices);
      // console.log(baseSymbols[rectangleIndex].text);
      // console.log(baseSymbols[rectangleIndex]);
      // console.log(baseSymbols[rectangleIndex].boundingBox.vertices);
    }
  }

  console.log('Overlap');

  for (const key in rectangleOverlapsGroups) {
    if (Object.prototype.hasOwnProperty.call(rectangleOverlapsGroups, key)) {
      const baseIndex = parseInt(key, 10);
      const baseSymbol: vision.protos.google.cloud.vision.v1.ISymbol = baseSymbols[baseIndex];
      const baseConfidence = baseSymbol.confidence;

      let highestConfidenceIndex = baseIndex;
      let highestConfidence = baseConfidence;

      const rectangleOverlapsGroup: number[] = rectangleOverlapsGroups[key];
      for (let index = 0; index < rectangleOverlapsGroup.length; index++) {
        const overlappedRectangleIndex: number = rectangleOverlapsGroup[index];
        const overlappedSymbol: vision.protos.google.cloud.vision.v1.ISymbol = baseSymbols[overlappedRectangleIndex];
        const overlappedConfidence = baseSymbol.confidence;

        if (overlappedConfidence > overlappedSymbol) {
          highestConfidenceIndex = overlappedRectangleIndex;
          highestConfidence = overlappedConfidence;
        }
      }
      console.log(highestConfidenceIndex, baseSymbols[highestConfidenceIndex].text, baseSymbols[highestConfidenceIndex].boundingBox.vertices);
      // console.log(highestConfidence);
      // console.log(baseSymbols[highestConfidenceIndex].text);
    }

  }
}

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

export const getWords = (request: Request, response: Response, next: any) => {

  getWords2(request, response, next);
  return;

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

            const candidateWord: string = clal0 + clal1 + clal2 + clal3 + clal4;

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

const base64ToImg = (img: string): Promise<string> => {

  // string generated by canvas.toDataURL()
  // var img = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0"
  //   + "NAAAAKElEQVQ4jWNgYGD4Twzu6FhFFGYYNXDUwGFpIAk2E4dHDRw1cDgaCAASFOffhEIO"
  //   + "3gAAAABJRU5ErkJggg==";
  // strip off the data: url prefix to get just the base64-encoded bytes
  var data = img.replace(/^data:image\/\w+;base64,/, "");
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

export const getWords2 = (request: Request, response: Response, next: any) => {

  const { imageDataBase64, candidateLettersAtLocation, lettersSomewhereInWord } = request.body;

  base64ToImg(imageDataBase64).then((filePath) => {
    visionTest2(filePath);
  });
}