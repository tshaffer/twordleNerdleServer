import * as vision from '@google-cloud/vision';
import { isBoolean } from 'lodash';

import { point } from '../types';
import { rectanglesOverlap } from '../utilities';


interface TwordleSymbol extends vision.protos.google.cloud.vision.v1.ISymbol {
  rowIndex: number,
  useSymbol: boolean;
};

type symbolArray = TwordleSymbol[];

interface overlapGroupMap {
  [id: number]: number[]; // index to array of indices
}

export const getTextFromImage = (): Promise<any> => {
  return textFromImage('wordleOut.png').then((data) => {
    console.log('data from textFromImage using wordleOut.png');
    console.log(data);

    return data;
  });
}

async function textFromImage(fileName: string) {

  const client = new vision.ImageAnnotatorClient();

  // Read a local image as a text document
  const [result]: vision.protos.google.cloud.vision.v1.IAnnotateImageResponse[] = await client.documentTextDetection(fileName);
  const lettersInRows: string[][] = analyzeOCRResult(result);
  console.log(lettersInRows);
}

async function xtextFromImage(fileName: string) {

  console.log('textFromImage');

  let imageWidth;
  let imageHeight: number;
  let rowHeight;
  let numberOfRows = 0;

  const client = new vision.ImageAnnotatorClient();

  // Read a local image as a text document
  const [result]: vision.protos.google.cloud.vision.v1.IAnnotateImageResponse[] = await client.documentTextDetection(fileName);


  analyzeOCRResult(result);

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
      // guesses[rowIndex] += symbol.text;
      guesses[rowIndex] = guesses[rowIndex] + symbol.text;
      // console.log(symbol.rowIndex, symbol.text, symbol.boundingBox.vertices);
    })
  });

  const data: any = {
    guesses,
  };

  return data;

}

const analyzeOCRResult = (result: vision.protos.google.cloud.vision.v1.IAnnotateImageResponse): string[][] => {

  const fullTextAnnotation: vision.protos.google.cloud.vision.v1.ITextAnnotation = result.fullTextAnnotation;
  const pages: vision.protos.google.cloud.vision.v1.IPage[] = fullTextAnnotation.pages;

  const lettersInRows: string[][] = [[], [], [], [], []];
  let rowIndex = 0;

  pages.forEach((page: vision.protos.google.cloud.vision.v1.IPage) => {
    const blocks: vision.protos.google.cloud.vision.v1.IBlock[] = page.blocks;
    blocks.forEach((block: vision.protos.google.cloud.vision.v1.IBlock) => {
      const paragraphs: vision.protos.google.cloud.vision.v1.IParagraph[] = block.paragraphs;
      paragraphs.forEach((paragraph) => {
        const words: vision.protos.google.cloud.vision.v1.IWord[] = paragraph.words;
        words.forEach((word) => {
          const symbols: vision.protos.google.cloud.vision.v1.ISymbol[] = word.symbols;
          symbols.forEach((symbol: vision.protos.google.cloud.vision.v1.ISymbol) => {
            lettersInRows[rowIndex].push((symbol as TwordleSymbol).text);
            if (lettersInRows[rowIndex].length === 5) {
              rowIndex++;
            }
          });
        });
      });
    });
  });

  return lettersInRows;
}