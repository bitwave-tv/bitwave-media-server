/**
 * @file this file is loaded on application start and initializes the application
 * @link https://github.com/bitwave-tv/bitwave-media-server
 * @copyright 2019 [bitwave.tv]
 * @license GPL-3.0
 */
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var path = require('path');
var config = require("./conf/config.json");
var EnvVar_1 = require("./classes/EnvVar");
var CFonts = require("cfonts");
var chalk = require("chalk");
var packageJson = require('../package.json');
// Import our code
var Nginxrtmp_1 = require("./classes/Nginxrtmp");
var Logger_1 = require("./classes/Logger");
// Setup Logger
var webLogger = Logger_1.default('BOOT');
// show start message
webLogger.info("Starting [bitwave.tv] Media Server " + chalk.bold.greenBright("v" + packageJson.version));
var fontOptions = {
    font: 'simple',
    align: 'center',
    space: false,
};
console.log(chalk.bold.greenBright(CFonts.render('bitwave.tv', fontOptions).string));
console.log(chalk.bold.cyan(CFonts.render('NGINX', fontOptions).string) + '\n');
// setup and log environment vars
EnvVar_1.envVar.init(config);
if (process.env.DEBUG === 'true')
    webLogger.info('Debugging enabled.', false);
EnvVar_1.envVar.list(webLogger);
// bail out if there are errors
if (EnvVar_1.envVar.hasErrors())
    process.exit();
// start NGINX-RTMP
Nginxrtmp_1.default(config)
    .start(process.env.RS_HTTPS === 'true')
    .then(function () { return webLogger.info("NGINX-RTMP STARTED"); })
    .catch(function (error) { return webLogger.error("Error starting webserver and nginx for application:\n" + error); });
//# sourceMappingURL=index.js.map