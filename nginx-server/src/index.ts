/**
 * @file this file is loaded on application start and initializes the application
 * @link https://github.com/bitwave-tv/bitwave-media-server
 * @copyright 2019 [bitwave.tv]
 * @license GPL-3.0
 */

'use strict';
const path = require('path');

import * as config from './conf/config.json';
import { envVar } from './classes/EnvVar';

import * as CFonts from 'cfonts';
import * as chalk from 'chalk';
const packageJson = require('../package.json');


// Import our code
import nginxRtmp from './classes/Nginxrtmp';
import logger from './classes/Logger';

// Setup Logger
const webLogger = logger( 'BOOT' );

// show start message
webLogger.info ( `Starting [bitwave.tv] Media Server ${chalk.bold.greenBright (`v${packageJson.version}`)}` );

const fontOptions = {
  font: 'simple',
  align: 'center',
  space: false,
};

console.log ( chalk.bold.greenBright ( CFonts.render( 'bitwave.tv',fontOptions ).string ) );
console.log ( chalk.bold.cyan        ( CFonts.render( 'NGINX', fontOptions ).string ) + '\n' );


// setup and log environment vars
envVar.init ( config );

if ( process.env.DEBUG === 'true' ) webLogger.info( 'Debugging enabled.', false );

envVar.list ( webLogger );

// bail out if there are errors
if ( envVar.hasErrors() ) process.exit();


// start NGINX-RTMP
const nginxServer = nginxRtmp ( config );
nginxServer
  .start (
    process.env.RS_HTTPS === 'true'
  )
  .then (
    () => webLogger.info( `NGINX-RTMP STARTED` )
  )
  .catch (
    error => webLogger.error( `Error starting webserver and nginx for application:\n${error}` )
  );


//--------------
// Graceful exit

// Define Shutdown
const shutdown = async ( signal, value ) => {
  console.log( `NGINX server stopped by ${signal} with value ${value}` );
  nginxServer.process.exit( 128 + value );
  console.log( 'shutdown!' );
};

import Signals = NodeJS.Signals;
const signals = {
  'SIGHUP': 1,
  'SIGINT': 2,
  'SIGTERM': 15,
};

// Create a listener for each of the signals that we want to handle
Object.keys( signals )
  .forEach( ( signal: Signals )  => {
    process.on( signal, async () => {
      console.log( `NGINX server received a ${signal} signal` );
      await shutdown( signal, signals[ signal ] );
    });
  });
