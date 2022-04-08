import { Request, Response } from 'express';

export const getTest = (request: Request, response: Response, next: any) => {

  console.log('getTest');

  console.log('request.query:');
  console.log(request.query);

  response.sendStatus(200);
};

export function postTest(request: Request, response: Response, next: any) {

  console.log('postTest');

  console.log('request.body:');
  console.log(request.body);

  response.sendStatus(200);
}
