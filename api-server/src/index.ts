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
const __public = path.join( __dirname, 'webserver', 'public' );

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


// For CI/CD
if ( process.env['CICD'] === 'true' ) {
  setTimeout( () => {
    process.exit( 0 );
  }, 5 * 1000 );
}

const server = bitwaveMediaServer ( __public );

// Define Startup
const startup = async () => {
  return await server.startWebserver();
};


import { serverData } from './classes/ServerData';

// Define Shutdown
const shutdown = async ( signal, value ) => {
  console.log( `Forcing all connected streamers ${chalk.redBright('offline')}` );
  await serverData.shutdown();
  console.log( 'shutdown!' );
  server.server.close(() => {
    console.log( `API server stopped by ${signal} with value ${value}` );
    process.exit( 128 + value );
  });
};


//--------------
// Graceful exit


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
      console.log( `API server received a ${signal} signal` );
      await shutdown( signal, signals[ signal ] );
    });
  });


//-----------------
// Fire it off! //
//---------------
startup().then();
