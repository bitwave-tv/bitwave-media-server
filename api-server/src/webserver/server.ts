/**
 * @link https://github.com/bitwave-tv/bitwave-media-server
 * @copyright 2019 [bitwave.tv]
 * @license GPL-3.0
 */

'use strict';

// express
import * as express from 'express';
import { Express } from 'express';
import { AddressInfo } from 'net';

import * as bodyParser from 'body-parser';
import * as compression from 'compression';

import * as chalk from 'chalk';

// other
import * as path from 'path';
import * as Q from 'q';

// modules
import logger from '../classes/Logger';
const nodeLogger = logger ( 'EXPRS' );

import api from './api';
// const apiV1 = require('./controllers/api/v1');

// middleware
import expressLogger from '../webserver/middleware/expressLogger';
import { Server } from 'http';

/**
 * Class for the bitwave media server, powered by express.js
 */
class BitwaveMediaServer {
  private readonly app: Express;
  private readonly __public: string;

  public server: Server;

  /**
   * constructs a new express app with prod or dev config
   */
  constructor ( publicDir ) {
    this.__public = publicDir;

    this.app = express();

    if (process.env.BMS_NODEJS_ENV === 'dev')
      this.initDev();
    else
      this.initProd();
  }

  /**
   * add automatic parsers for the body
   */
  addParsers () {
    this.app.use( bodyParser.json() );
    this.app.use( bodyParser.urlencoded ({ extended: true } ) );
  }

  /**
   * add content compression on responses
   */
  addCompression () {
    this.app.use( compression() );
  }

  /**
   * add express logger
   */
  addExpressLogger () {
    this.app.use( '/', expressLogger );
  }

  /**
   * beautify json response
   */
  beautifyJSONResponse () {
    this.app.set( 'json spaces', 4 );
  }

  /**
   * add favicon
   */
  addFavicon () {
    this.app.get(
      '/favicon.ico',
      express.static( path.join ( this.__public, 'favicon.ico' ) ),
    );
  }

  addPreviewThumbnails () {
    this.app.use(
      '/preview',
      express.static( '/tmp/preview' ),
    );
  }

  /**
   * add routes
   */
  addRoutes () {
    // router( this.app );
    // this.app.use('/v1', apiV1);
    this.app.use( '/', api );
  }

  /**
   * add 404 error handling on pages, that have not been found
   */
  add404ErrorHandling () {
    this.app.use( ( req, res, next ) => {
      const err = new Error( `404 Error: ${req.url}` );
      res.status( 404 );
      next( err );
    });
  }

  /**
   * add ability for internal server errors
   */
  add500ErrorHandling () {
    this.app.use( ( err, req, res, next ) => {
      nodeLogger.error( err );
      res.status( err.status || 500 );
      res.send({ message: err.message, error: {} });
    });
  }

  /**
   * start the webserver and open the websocket
   * @returns {*|promise}
   */
  startWebserver () {
    const deferred = Q.defer();
    nodeLogger.info ( 'Starting Node.js API server . . .' );
    this.app.set( 'port', process.env.BMS_NODEJS_PORT );
    this.server = this.app.listen ( this.app.get ( 'port' ), () => {
      this.app.set ( 'server', this.server.address() );
      nodeLogger.info( `Node.js API server running on ${process.env.BMS_NODEJS_PORT}` );
      deferred.resolve( (this.server.address() as AddressInfo).port );
    });
    return deferred.promise;
  }

  /**
   * stuff that have always to be added to the webapp
   */
  initAlways () {
    this.addParsers();
    this.addCompression();
    this.addExpressLogger();
    this.beautifyJSONResponse();
    this.addFavicon();
    this.addPreviewThumbnails();
    this.addRoutes();
  }

  /**
   * prod config for the express app
   */
  initProd () {
    nodeLogger.debug ( 'Starting API server - PROD environment' );
    this.initAlways();
    this.app.get ( '/', ( req, res ) => {
      res.sendFile ( path.join ( this.__public, 'index.prod.html' ) );
    });
    this.add404ErrorHandling();
    this.add500ErrorHandling();
  }

  /**
   * dev config for the express app
   */
  initDev () {
    nodeLogger.debug ( 'Starting API server - DEV environment' );
    this.initAlways();
    this.app.get ( '/', ( req, res ) => {
      res.sendFile ( path.join ( this.__public, 'index.dev.html' ) );
    });
    this.add404ErrorHandling();
    this.add500ErrorHandling();
  }
}

export const bitwaveMediaServer = publicDir => new BitwaveMediaServer( publicDir );
