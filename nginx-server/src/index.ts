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
const packageJson = require('../package.json');


// Import our code
import nginxRtmp from './classes/Nginxrtmp';
import logger from './classes/Logger';

// Setup Logger
const webLogger = logger( './src/webserver' );

// show start message
webLogger.info ( `Starting [bitwave.tv] Media Server v${packageJson.version}` );

webLogger.info (
  '\x1b[1m\x1b[32m'+
  CFonts.render('[bitwave.tv]', {font: 'simple', color: '#0f0', align: 'center'}).string
    +'\x1b[0m'
);


// setup and log environment vars
envVar.init ( config );

if ( process.env.DEBUG === 'true' ) webLogger.info( 'Debugging enabled.', false );

envVar.list ( webLogger );

// bail out if there are errors
if ( envVar.hasErrors() ) process.exit();


// start NGINX-RTMP
nginxRtmp ( config )
  .start (
    process.env.RS_HTTPS === 'true'
  )
  .then (
    () => console.log( `NGINX-RTMP STARTED` )
  )
  .catch (
    error => webLogger.error( `Error starting webserver and nginx for application:\n${error}` )
  );
