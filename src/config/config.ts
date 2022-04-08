import * as dotenv from 'dotenv';
import { isNil } from 'lodash';
import { TwordleConfiguration } from '../types';

export let twordleConfiguration: TwordleConfiguration; 

export const readConfig = (pathToConfigFile: string): void => {

  try {
    const configOutput: dotenv.DotenvConfigOutput = dotenv.config({ path: pathToConfigFile });
    const parsedConfig: dotenv.DotenvParseOutput | undefined = configOutput.parsed;

    if (!isNil(parsedConfig)) {
      twordleConfiguration = {
        PORT: Number(parsedConfig.PORT),
      };
      console.log(twordleConfiguration);
    }
  }
  catch (err) {
    console.log('Dotenv config error: ' + err.message);
  }
};
