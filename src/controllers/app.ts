import { Request, Response } from 'express';
const en = require('dictionary-en');
import * as fs from 'fs';
import { isNil } from 'lodash';

import { version } from '../version';

let spellchecker: { parse: (arg0: { aff: Buffer; dic: Buffer; }) => any; use: (arg0: any) => void; check: (arg0: string) => any; };

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
