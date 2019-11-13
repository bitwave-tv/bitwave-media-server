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
var __public = path.join(__dirname, 'webserver', 'public');
var config = require("./conf/config.json");
var EnvVar_1 = require("./classes/EnvVar");
var CFonts = require("cfonts");
var chalk = require("chalk");
var packageJson = require('../package.json');
var server_1 = require("./webserver/server");
var Logger_1 = require("./classes/Logger");
var webLogger = Logger_1.default('./webserver');
// show start message
webLogger.info("Starting [bitwave.tv] Media Server " + chalk.bold.greenBright("v" + packageJson.version));
var fontOptions = {
    font: 'simple',
    align: 'center',
    space: false,
};
console.log(chalk.bold.greenBright(CFonts.render('bitwave.tv', fontOptions).string));
console.log(chalk.bold.cyan(CFonts.render('NODE', fontOptions).string) + '\n');
// setup environment vars
EnvVar_1.envVar.init(config);
if (process.env.DEBUG === 'true')
    webLogger.info('Debugging enabled. Check the /debug path in the web interface.', false);
// list environment variables
EnvVar_1.envVar.list(webLogger);
// bail out if there are errors
if (EnvVar_1.envVar.hasErrors())
    process.exit();
// start the app
var server = server_1.bitwaveMediaServer(__public);
server.startWebserver();
//# sourceMappingURL=index.js.map