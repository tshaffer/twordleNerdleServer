"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWords = exports.getVersion = exports.initializeSpellChecker = void 0;
const en = require('dictionary-en');
const fs = __importStar(require("fs"));
const lodash_1 = require("lodash");
const version_1 = require("../version");
let spellchecker;
const initializeSpellChecker = () => {
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
exports.initializeSpellChecker = initializeSpellChecker;
const getVersion = (request, response, next) => {
    console.log('getVersion');
    const data = {
        serverVersion: version_1.version,
    };
    response.json(data);
};
exports.getVersion = getVersion;
const getWords = (request, response, next) => {
    console.log('getWords');
    console.log(request.body);
    const { candidateLettersAtLocation, lettersSomewhereInWord } = request.body;
    const words = [];
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
                        const candidateWord = clal0 + clal1 + clal2 + clal3 + clal4;
                        // console.log(candidateWord + candidateWord.length);
                        // ensure that word contains all lettersNotAtExactLocation
                        let allLettersSomewhereInWordAreInThisWord = true;
                        const candidateWordAsArray = candidateWord.split('');
                        for (const letterSomewhereInWord of lettersSomewhereInWord) {
                            if (!(0, lodash_1.isNil)(letterSomewhereInWord)) {
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
exports.getWords = getWords;
//# sourceMappingURL=app.js.map