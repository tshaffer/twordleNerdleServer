import { Request, Response } from 'express';
const en = require('dictionary-en');
import * as fs from 'fs';
import { isNil } from 'lodash';

import { version } from '../version';

let spellchecker: { parse: (arg0: { aff: Buffer; dic: Buffer; }) => any; use: (arg0: any) => void; check: (arg0: string) => any; };

const vision = require('@google-cloud/vision');

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
async function visionTest2() {

  // Creates a client
  const client = new vision.ImageAnnotatorClient();

  /**
   * TODO(developer): Uncomment the following line before running the sample.
   */
  const fileName = '/Users/tedshaffer/Documents/Projects/twordleNerdleClient/programmaticallyGenerated-0.png';

  // Read a local image as a text document
  const [result] = await client.documentTextDetection(fileName);
  const fullTextAnnotation: any = result.fullTextAnnotation;
  console.log(`Full text: ${fullTextAnnotation.text}`);
  const pages = fullTextAnnotation.pages as any[];
  pages.forEach((page) => {
    // (fullTextAnnotation.pages as any).forEach(page: any => {
    const blocks: any[] = page.blocks as any[];
    blocks.forEach(block => {
      console.log(`Block confidence: ${block.confidence}`);
      const paragraphs: any[] = block.paragraphs as any[];
      paragraphs.forEach(paragraph => {
        console.log(`Paragraph confidence: ${paragraph.confidence}`);
        const words: any[] = paragraph.words as any[];
        words.forEach(word => {
          const symbols: any[] = word.symbols as any[];
          const wordText = symbols.map(s => s.text).join('');
          console.log(`Word text: ${wordText}`);
          console.log(`Word confidence: ${word.confidence}`);
          symbols.forEach(symbol => {
            console.log(`Symbol text: ${symbol.text}`);
            console.log(`Symbol confidence: ${symbol.confidence}`);
          });
        });
      });
    });
  });// end
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

  // console.log('visionTest2');
  // visionTest2();

  // console.log('visionTest');
  // visionTest();

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

const base64ToImg = (img: string) => {

  // string generated by canvas.toDataURL()
  // var img = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0"
  //   + "NAAAAKElEQVQ4jWNgYGD4Twzu6FhFFGYYNXDUwGFpIAk2E4dHDRw1cDgaCAASFOffhEIO"
  //   + "3gAAAABJRU5ErkJggg==";
  // strip off the data: url prefix to get just the base64-encoded bytes
  var data = img.replace(/^data:image\/\w+;base64,/, "");
  var buf = new Buffer(data, 'base64');
  console.log('invoke fs.write');
  fs.writeFile('image.png', buf, (err) => {
    console.log('fs.writeFile callback');
    if (err) {
      console.log('write error', err);
    }
  });
}

export const getWords2 = (request: Request, response: Response, next: any) => {

  console.log('getWords2');
  console.log(request.body);

  const { imageDataBase64, candidateLettersAtLocation, lettersSomewhereInWord } = request.body;

  console.log('getWords2 - invoked base64ToImg');
  base64ToImg(imageDataBase64);
  console.log('getWords2 - return from base64ToImg');

}