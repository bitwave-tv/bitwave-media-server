/**
 * @file holds the code for the class NGINX
 * @link https://github.com/bitwave-tv/bitwave-media-server
 * @copyright 2019 [bitwave.tv]
 * @license GPL-3.0
 */
'use strict';

import { spawn } from 'child_process';

import logger from './Logger';

import * as Q from 'q';
import * as rp from 'request-promise';
import * as chalk from 'chalk';

let abort;

/**
 * Class to watch and control the NGINX RTMP server process
 */
class Nginxrtmp {
  config: any;
  logger: any;
  public process: any;
  private allowRestart: boolean;

  /**
   * Constructs the NGINX rtmp with injection of config to use
   * @param config
   */
  constructor ( config ) {
    this.config = config;
    this.logger = logger('NGINX');
    this.process = null;        // Process handler
    this.allowRestart = false;  // Whether to allow restarts. Restarts are not allowed until the first successful start
  }

  /**
   * Start the NGINX server
   * @returns {Promise.<boolean>}
   */
  async start ( useSSL?: boolean ) {
    this.logger.info( 'Starting NGINX . . .' );
    let timeout = 250;
    abort = false;

    if ( !useSSL ) {
      this.process = spawn( this.config.nginx.command, this.config.nginx.args );
    }
    else {
      this.logger.info( 'Enabling HTTPS' );
      this.process = spawn( this.config.nginx.command, this.config.nginx.args_ssl );
    }

    this.process.stdout.on('data', data => {
      let lines = data.toString().split(/[\r\n]+/);

      for (let i = 0; i < lines.length; i++) {
        let line = lines[i].replace(/^.*]/, '').trim();
        if (line.length === 0) {
          continue;
        }

        this.logger.info(line);
      }
    });

    this.process.stderr.on('data', data => {
      let lines = data.toString().split(/[\r\n]+/);

      for (let i = 0; i < lines.length; i++) {
        let line = lines[i].replace(/^.*]/, '').trim();
        if (line.length === 0) {
          continue;
        }

        this.logger.error(line);
      }
    });

    this.process.on('close', code => {
      abort = true;

      this.logger.error(`NGINX Exited with code: ${code}`);

      if (code < 0) {
        return;
      }

      if (this.allowRestart === true) {
        let self = this;
        setTimeout(() => {
          self.logger.info('Trying to restart NGINX . . .');
          self.start();
        }, timeout);
      }
    });

    this.process.on('error', err => {
      this.logger.error(`Failed to spawn NGINX process:\n${err.name}: ${err.message}`);
    });

    let running = false;

    while ( !running ) {
      running = await this.isRunning( timeout );
      if ( abort === true ) {
        this.logger.info( chalk.bgRedBright.black( ' Aborted! ' ) );
        break;
      }
    }

    if ( running === false ) {
      this.process = null;
      throw new Error( 'Failed to start NGINX' );
    } else {
      this.allowRestart = true;
      this.logger.info( 'Successfully started NGINX' );
    }

    return true;
  }

  /**
   * Get current state of the NGINX server
   * @returns {Promise.<boolean>}
   */
  async isRunning ( delay: number ) {
    const url = `http://${this.config.nginx.streaming.ip}:${this.config.nginx.streaming.http_port}${this.config.nginx.streaming.http_health_path}`;

    try {
      await Q.delay( delay ); // delay the state detection by the given amount of milliseconds
      const response = await rp(url);
      return response === 'pong';
    } catch( error ) {
      console.log( error );
      return false;
    }
  }
}

export default config => new Nginxrtmp( config );
