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
exports.getBundleMap = exports.getBundle = exports.getCSS = exports.getIndex = void 0;
const path = __importStar(require("path"));
function getIndex(request, response) {
    console.log('getIndex invoked');
    const pathToIndex = path.join(__dirname, '../../public', 'index.html');
    console.log('pathToIndex');
    console.log(pathToIndex);
    response.sendFile(pathToIndex);
}
exports.getIndex = getIndex;
function getCSS(request, response) {
    const pathToCSS = path.join(__dirname, '../../public', 'css', 'app.css');
    response.sendFile(pathToCSS);
}
exports.getCSS = getCSS;
function getBundle(request, response) {
    console.log('getBundle invoked');
    const pathToBundle = path.join(__dirname, '../../public', 'build', 'bundle.js');
    console.log('pathToBundle');
    console.log(pathToBundle);
    response.sendFile(pathToBundle);
}
exports.getBundle = getBundle;
function getBundleMap(request, response) {
    console.log('getBundleMap invoked');
    const pathToBundleMap = path.join(__dirname, '../../public', 'build', 'bundle.js.map');
    console.log(pathToBundleMap);
    response.sendFile(pathToBundleMap);
}
exports.getBundleMap = getBundleMap;
//# sourceMappingURL=mainController.js.map