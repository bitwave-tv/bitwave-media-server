/**
 * @file holds the code for the class Logger
 * @link https://github.com/bitwave-tv/bitwave-media-server
 * @copyright 2019 [bitwave.tv]
 * @license GPL-3.0
 */
'use strict';

import * as fs from 'fs';

import * as moment from 'moment-timezone';

const LEVEL_MUTE  = 0;
const LEVEL_ERROR = 1;
const LEVEL_WARN  = 2;
const LEVEL_INFO  = 3;
const LEVEL_DEBUG = 4;

let BMS_LOGLEVEL  = 0;
let BMS_DEBUG     = false;

/**
 * Class for logger
 */
class Logger {
  private readonly context: any;
  private readonly debuglog: number;

  static LEVEL_ERROR : number;
  static LEVEL_WARN  : number;
  static LEVEL_INFO  : number;
  static LEVEL_DEBUG : number;

  /**
   * check if the logger is muted
   * @returns {boolean}
   */
  static isMuted () {
    return parseInt ( process.env.BMS_LOGLEVEL, 10 ) === LEVEL_MUTE;
  }

  /**
   * construct a logger object
   * @param {string} context context of the log message (classname.methodname)
   */
  constructor ( context ) {
    BMS_LOGLEVEL = parseInt ( process.env.BMS_LOGLEVEL, 10 ) || LEVEL_DEBUG;
    BMS_DEBUG = ( process.env.BMS_DEBUG === "true" );

    this.context = context;
    this.debuglog = null;

    if ( BMS_DEBUG === true ) {
      let identifier = `${process.pid}-${process.platform}-${process.arch}`;
      try {
        this.debuglog = fs.openSync( `/bms-nginx-server/src/webserver/public/debug/BMS-${identifier}.txt`, 'a' );
      } catch ( err ) {
        this.debuglog = null;
        this.stdout( `Error opening debug file ${identifier}: ${err}`, context, 'INFO' );
      } finally {
        this.stdout( `Enabled logging to ${identifier}`, context, 'INFO' );
      }
    }
  }

  logline ( message, context, type ) {
    const timezone = process.env.BMS_TIMEZONE || 'America/Los_Angeles';
    let time = moment().tz( timezone ).format( 'MM-DD HH:mm:ss' );
    let logline = '';
    if ( context )
      logline = `[${time}] [${type.padStart(5, ' ')}] [${context.padStart(5, ' ')}] ${message}`;
    else
      logline = `[${time}] [${type.padStart(5, ' ')}] ${message}`;
    return logline;
  }

  /**
   * print a message to stdout
   * @param {string} message
   * @param {string} context
   * @param {string} type
   */
  stdout ( message, context, type ) {
    if ( Logger.isMuted() ) return;
    const logline = this.logline( message, context, type );
    process.stdout.write( `${logline}\n` );
  }

  /**
   * print a message to a file
   * @param {string} message
   * @param {string} context
   * @param {string} type
   */
  file ( message, context, type ) {
    const logline = this.logline ( message, context, type );
    if ( this.debuglog !== null ) {
      fs.appendFile( this.debuglog, `${logline}\n`, 'utf8', err => {
        // ignore errors
        if ( err ) return;
        fs.fsync( this.debuglog, err => null );
        return;
      });
    }
  }

  /**
   * print an info message if LOG_LEVEL >= LEVEL_INFO
   * @param {string} message
   * @param {string=} context
   * @param {boolean=} alertGui
   */
  info ( message, context?, alertGui? ) {
    let loggerContext  = context;
    let loggerAlertGui = alertGui;

    if ( typeof context === 'undefined' )
      loggerContext = this.context;

    if ( typeof alertGui === 'undefined' )
      loggerAlertGui = false;

    if ( BMS_DEBUG === true )
      this.file( message, loggerContext, 'INFO' );

    if ( BMS_LOGLEVEL >= LEVEL_INFO )
      return this.stdout( message, loggerContext, 'INFO' );

    // todo: if alertGui is activated on frontend and websockets controller, insert emit here
    if ( loggerAlertGui ) return;
  }

  /**
   * print a warning message if LOG_LEVEL >= LEVEL_WARN
   * @param {string} message
   * @param {string=} context
   * @param {boolean=} alertGui
   */
  warn ( message, context?, alertGui? ) {
    let loggerContext  = context;
    let loggerAlertGui = alertGui;

    if ( typeof context === 'undefined' )
      loggerContext = this.context;

    if ( typeof alertGui === 'undefined' )
      loggerAlertGui = false;

    if ( BMS_DEBUG === true )
      this.file ( message, loggerContext, 'WARN' );

    if ( BMS_LOGLEVEL >= LEVEL_WARN )
      return this.stdout ( message, loggerContext, 'WARN' );
  }

  /**
   * print a debug message if LOG_LEVEL >= LEVEL_DEBUG
   * @param {string} message
   * @param {string=} context
   * @param {boolean=} alertGui
   */
  debug ( message, context?, alertGui? ) {
    let loggerContext  = context;
    let loggerAlertGui = alertGui;

    if ( typeof context === 'undefined' )
      loggerContext = this.context;

    if ( typeof alertGui === 'undefined' )
      loggerAlertGui = false;

    if ( BMS_DEBUG === true )
      this.file ( message, loggerContext, 'DEBUG' );

    if ( BMS_LOGLEVEL >= LEVEL_DEBUG )
      return this.stdout ( message, loggerContext, 'DEBUG' );

    // todo: if alertGui is activated on frontend and websockets controller, insert emit here
    if ( loggerAlertGui ) return;
  }

  /**
   * print a debug message if LOG_LEVEL >= LEVEL_ERROR
   * sends a string to
   * @param {string} message
   * @param {string=} context
   * @param {boolean=} alertGui
   */
  error ( message, context?, alertGui? ) {
    let loggerContext  = context;
    let loggerAlertGui = alertGui;

    if ( typeof context === 'undefined' )
      loggerContext = this.context;

    if ( typeof alertGui === 'undefined' )
      loggerAlertGui = false;

    if ( BMS_DEBUG === true )
      this.file ( message, loggerContext, 'ERROR' );

    if ( BMS_LOGLEVEL >= LEVEL_ERROR )
      return this.stdout( message, loggerContext, 'ERROR' );

    // todo: if alertGui is activated on frontend and websockets controller, insert emit here
    if ( loggerAlertGui ) return;
  }
}

// define log levels in logger class
Logger.LEVEL_ERROR = LEVEL_ERROR;
Logger.LEVEL_WARN  = LEVEL_WARN;
Logger.LEVEL_INFO  = LEVEL_INFO;
Logger.LEVEL_DEBUG = LEVEL_DEBUG;

export default context => new Logger( context );
