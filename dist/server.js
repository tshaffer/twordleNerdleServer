"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
/**
 * Start Express server.
 */
const port = Number(app_1.default.get('port'));
const server = app_1.default.listen(port, () => {
    console.log('  App is running at http://localhost:%d in %s mode', port, app_1.default.get('env'));
    console.log('  Press CTRL-C to stop\n');
});
// Handle unhandled promise rejection
process.on('unhandledRejection', (err, promise) => {
    console.log(`Error: ${err.message}`);
    // Close server and exit process
    server.close(() => process.exit(1));
});
exports.default = server;
//# sourceMappingURL=server.js.map