/**
 * @file this file is loaded on application start and initializes the application
 * @link https://github.com/bitwave-tv/bitwave-media-server
 * @copyright 2019 [bitwave.tv]
 * @license GPL-3.0
 */
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var path = require('path');
// const __src = __dirname;
// const __base = path.join(__dirname, '..');
// const __public = path.join(__dirname, 'webserver', 'public');
var config = require("./conf/config.json");
var EnvVar_1 = require("./classes/EnvVar");
var CFonts = require("cfonts");
var packageJson = require('../package.json');
// Import our code
var Nginxrtmp_1 = require("./classes/Nginxrtmp");
var Logger_1 = require("./classes/Logger");
// Setup Logger
var webLogger = Logger_1.default('./src/webserver');
// show start message
webLogger.info("Starting [bitwave.tv] Media Server v" + packageJson.version);
webLogger.info('\x1b[1m\x1b[32m' +
    CFonts.render('[bitwave.tv]', { font: 'simple', color: '#0f0', align: 'center' }).string
    + '\x1b[0m');
// setup and log environment vars
EnvVar_1.envVar.init(config);
if (process.env.DEBUG === 'true')
    webLogger.info('Debugging enabled. Check the /debug path in the web interface.', false);
EnvVar_1.envVar.list(webLogger);
// bail out if there are errors
if (EnvVar_1.envVar.hasErrors())
    process.exit();
// start NGINX-RTMP
Nginxrtmp_1.default(config)
    .start(process.env.RS_HTTPS === 'true')
    .then(function () { return console.log("NGINX-RTMP STARTED"); })
    .catch(function (error) { return webLogger.error("Error starting webserver and nginx for application:\n" + error); });
//# sourceMappingURL=index.js.map