import * as vision from '@google-cloud/vision';
import { isString } from 'lodash';

interface TwordleSymbol extends vision.protos.google.cloud.vision.v1.ISymbol {
  rowIndex: number,
  useSymbol: boolean;
};

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
  const guesses: string[] = analyzeOCRResult(result);
  console.log(guesses);

  const data: any = {
    guesses,
  };

  return data;
}

const analyzeOCRResult = (result: vision.protos.google.cloud.vision.v1.IAnnotateImageResponse): string[] => {

  const fullTextAnnotation: vision.protos.google.cloud.vision.v1.ITextAnnotation = result.fullTextAnnotation;
  const pages: vision.protos.google.cloud.vision.v1.IPage[] = fullTextAnnotation.pages;

  const words: string[] = ['', '', '', '', ''];
  let rowIndex = 0;

  pages.forEach((page: vision.protos.google.cloud.vision.v1.IPage) => {
    const blocks: vision.protos.google.cloud.vision.v1.IBlock[] = page.blocks;
    blocks.forEach((block: vision.protos.google.cloud.vision.v1.IBlock) => {
      const paragraphs: vision.protos.google.cloud.vision.v1.IParagraph[] = block.paragraphs;
      paragraphs.forEach((paragraph) => {
        const ocrWords: vision.protos.google.cloud.vision.v1.IWord[] = paragraph.words;
        ocrWords.forEach((word) => {
          const symbols: vision.protos.google.cloud.vision.v1.ISymbol[] = word.symbols;
          symbols.forEach((symbol: vision.protos.google.cloud.vision.v1.ISymbol) => {
            if (isString((symbol as TwordleSymbol).text)) {
              const updatedWord = words[rowIndex] + (symbol as TwordleSymbol).text;
              words[rowIndex] = updatedWord;
            }
            if (words[rowIndex].length === 5) {
              rowIndex++;
            }
          });
        });
      });
    });
  });

  return words;
}