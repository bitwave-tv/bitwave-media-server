/**
 * @file this file is loaded on application start and initializes the application
 * @link https://github.com/bitwave-tv/bitwave-media-server
 * @copyright 2019 [bitwave.tv]
 * @license GPL-3.0
 */

'use strict';
const path = require('path');

const __src = __dirname;
const __base = path.join(__dirname, '..');
const __public = path.join(__dirname, 'webserver', 'public');

import * as config from './conf/config.json';
import { envVar } from './classes/EnvVar'

// setup environment vars
envVar.init(config);

import * as CFonts from 'cfonts';
const packageJson = require('../package.json');

import nginxRtmp from './classes/Nginxrtmp';

import { bitwaveMediaServer } from './webserver/server';

import logger from './classes/Logger';
const webLogger = logger('webserver');

if (process.env.DEBUG === 'true') {
    webLogger.info('Debugging enabled. Check the /debug path in the web interface.', false);
}

// show start message
webLogger.info(`Starting [bitwave.tv] Media Server v${packageJson.version}`);

webLogger.info('\x1b[1m\x1b[32m'+
    CFonts.render('[bitwave.tv]', {
    font: 'simple',
    color: '#0f0',
    align: 'center',
}).string +
'\x1b[0m');

// list environment variables
envVar.list(webLogger);

// bail out if there are errors
if (envVar.hasErrors()) {
    process.exit();
}

// start the app
nginxRtmp(config)
    .start(process.env.RS_HTTPS === 'true')
    .then(() => {
        const server = bitwaveMediaServer(__public);
        return server.startWebserver();
    })
    .catch((error) => {
        webLogger.error(`Error starting webserver and nginx for application: ${error}`);
    });
