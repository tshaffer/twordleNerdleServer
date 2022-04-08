"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postTest = exports.getTest = void 0;
const getTest = (request, response, next) => {
    console.log('getTest');
    console.log('request.query:');
    console.log(request.query);
    response.sendStatus(200);
};
exports.getTest = getTest;
function postTest(request, response, next) {
    console.log('postTest');
    console.log('request.body:');
    console.log(request.body);
    response.sendStatus(200);
}
exports.postTest = postTest;
//# sourceMappingURL=testEndpoints.js.map