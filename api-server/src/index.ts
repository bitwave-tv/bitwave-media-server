/**
 * @file this file is loaded on application start and initializes the application
 * @link https://github.com/bitwave-tv/bitwave-media-server
 * @copyright 2019 [bitwave.tv]
 * @license GPL-3.0
 */

'use strict';
const path = require('path');

// const __src = __dirname;
// const __base = path.join(__dirname, '..');
const __public = path.join(__dirname, 'webserver', 'public');

import * as config from './conf/config.json';
import { envVar } from './classes/EnvVar';

import * as CFonts from 'cfonts';
import * as chalk from 'chalk';
const packageJson = require('../package.json');

import { bitwaveMediaServer } from './webserver/server';
import logger from './classes/Logger';

const webLogger = logger( 'BOOT' );

// show start message
webLogger.info ( `Starting [bitwave.tv] Media Server ${chalk.bold.greenBright (`v${packageJson.version}`)}` );

const fontOptions = {
  font: 'simple',
  align: 'center',
  space: false,
};

console.log ( chalk.bold.greenBright ( CFonts.render('bitwave.tv',fontOptions).string ) );
console.log ( chalk.bold.cyan        ( CFonts.render('NODE', fontOptions).string ) + '\n' );


// setup environment vars
envVar.init ( config );

if ( process.env.DEBUG === 'true' ) webLogger.info( 'Debugging enabled. Check the /debug path in the web interface.', false );

// list environment variables
envVar.list ( webLogger );

// bail out if there are errors
if ( envVar.hasErrors() ) process.exit();


if ( process.env['CICD'] === 'true' ) {
  setTimeout( () => {
    process.exit( 0 );
  }, 5 * 1000 );
}


// start the app
const server = bitwaveMediaServer ( __public );
server.startWebserver();
