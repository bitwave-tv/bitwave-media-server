/**
 * @file this file is loaded on application start and initializes the application
 * @link https://github.com/bitwave-tv/bitwave-media-server
 * @copyright 2019 [bitwave.tv]
 * @license GPL-3.0
 */
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var path = require('path');
var __src = __dirname;
var __base = path.join(__dirname, '..');
var __public = path.join(__dirname, 'webserver', 'public');
var config = require("./conf/config.json");
var EnvVar_1 = require("./classes/EnvVar");
// setup environment vars
EnvVar_1.envVar.init(config);
var CFonts = require("cfonts");
var packageJson = require('../package.json');
var Nginxrtmp_1 = require("./classes/Nginxrtmp");
var server_1 = require("./webserver/server");
var Logger_1 = require("./classes/Logger");
var webLogger = Logger_1.default('webserver');
if (process.env.DEBUG === 'true') {
    webLogger.info('Debugging enabled. Check the /debug path in the web interface.', false);
}
// show start message
webLogger.info("Starting [bitwave.tv] Media Server v" + packageJson.version);
webLogger.info('\x1b[1m\x1b[32m' +
    CFonts.render('[bitwave.tv]', {
        font: 'simple',
        color: '#0f0',
        align: 'center',
    }).string +
    '\x1b[0m');
// list environment variables
EnvVar_1.envVar.list(webLogger);
// bail out if there are errors
if (EnvVar_1.envVar.hasErrors()) {
    process.exit();
}
// start the app
Nginxrtmp_1.default(config)
    .start(process.env.RS_HTTPS === 'true')
    .then(function () {
    var server = server_1.bitwaveMediaServer(__public);
    return server.startWebserver();
})
    .catch(function (error) {
    webLogger.error("Error starting webserver and nginx for application: " + error);
});
//# sourceMappingURL=index.js.map