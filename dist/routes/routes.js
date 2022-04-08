"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Routes = void 0;
const controllers_1 = require("../controllers");
class Routes {
    routes(app) {
        this.createRoutes(app);
    }
    createRoutes(app) {
        app.get('/', controllers_1.getIndex);
        app.get('/index.html', controllers_1.getIndex);
        app.get('/css/app.css', controllers_1.getCSS);
        app.get('/build/bundle.js', controllers_1.getBundle);
        app.get('/build/bundle.js.map', controllers_1.getBundleMap);
    }
}
exports.Routes = Routes;
//# sourceMappingURL=routes.js.map