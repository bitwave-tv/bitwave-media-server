// Created by xander on 10/30/2019

'use strict';

import logger from './Logger';
const log = logger('AUTH');

import * as chalk from 'chalk';
import * as admin from 'firebase-admin';

// Do not attempt to log credentials for CI/CD pipeline
const CICD = process.env['CICD'] === 'true';
if ( !CICD ) {
  const serviceAccount = require('../../creds/service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert( serviceAccount ),
    databaseURL: 'https://bitwave-7f415.firebaseio.com',
  });
}

const hlsStream  = `hls`;
const transcodeStream = `transcode`;
const thumbnail  = `preview`;

class StreamAuth {
  private readonly hostServer: string;
  private readonly cdnServer: string;

  constructor( config ) {
    this.hostServer = config.hostServer;
    this.cdnServer  = config.cdnServer;
  }

  /**
   * Retrieves a user's stream key if available
   * @param username - The user whose key to retrieve
   * @returns {Promise<*>} - Returns key if found, else null
   */
  async getStreamKey ( username: string ) {
    const streamRef = admin.firestore().collection( 'users' ).where( '_username', '==', username.toLowerCase() ).limit( 1 );
    const docs = await streamRef.get();

    if ( !docs.empty ) {
      const key = docs.docs[0].get( 'streamkey' );

      if ( !!key )
        return key; // User has a key

      if ( key === undefined )
        log.info( `${username} does not have a key! (undefined)` );
      else
        log.info( `${chalk.bgRedBright.black(' ERROR: ')} ${username}'s key is invalid! '${key}'` );

      return null;
    } else {
      log.info( `${chalk.bgRedBright.black(' ERROR: ')}  User ${chalk.bgYellowBright(username)} could not be found!` );
      return undefined;
    }
  };

  /**
   * Verify & Authorize a user's stream via streamkey
   * @param username - name of user attempting to stream
   * @param key - user's streamkey
   * @returns {Promise<boolean>} - Returns true if user's streamkey matches database
   */
  async checkStreamKey ( username: string, key: string ) {
    if ( !key ) {
      log.info( `${chalk.bgRedBright.black(' ERROR: ')} ${username} did not provide a streamkey.` );
      return false;
    }

    const streamKey = await this.getStreamKey( username );
    if ( !streamKey ) {
      log.info(`${chalk.bgRedBright.black(' ERROR: ')} ${username} does not have a stream key` );
      return false;
    }

    if ( key !== streamKey ) {
      log.info( `${chalk.bgRedBright.black(' ERROR: ')} ${username} supplied an invalid streamkey` );
      return false;
    }

    if ( key === streamKey ) {
      log.info( `${chalk.bgGreenBright.black(' SUCCESS: ')} ${username}'s stream authorized` );
      return true;
    }

    log.info( `${chalk.bgRedBright.black(' ERROR: ')} Unknown fail condiiton while attempting to authorize stream!` );
    return false;
  };

  /**
   * Set streamer live status and transcode status
   * @param username - Streamer's username
   * @param state - LIVE / OFFLINE status
   */
  async setLiveStatus ( username: string, state: boolean ) {
    const streamRef = admin.firestore().collection( 'streams' ).doc( username.toLowerCase() );
    const doc = await streamRef.get();

    if ( !doc.exists ) {
      log.info( `${chalk.bgRedBright.black('ERROR:')} ${username} is not a valid streamer` );
      return;
    }

    const streamUrl = `https://${this.cdnServer}/${hlsStream}/${username}/index.m3u8`;
    const thumbUrl  = `https://${this.cdnServer}/${thumbnail}/${username}.png`;

    await streamRef.update({
      live: state,
      url: streamUrl,
      thumbnail: thumbUrl,
    });

    log.info( `${chalk.cyanBright(username)} is now ${ state ? chalk.greenBright.bold('LIVE') : chalk.redBright.bold('OFFLINE') }` );
  };

  /**
   * Set transcode status and livestream endpoint
   * @param username - Streamer's username
   * @param transcoded - Transcode status
   */
  async setTranscodeStatus ( username: string, transcoded: boolean ) {
    const streamRef = admin.firestore().collection( 'streams' ).doc( username.toLowerCase() );
    const doc = await streamRef.get();

    if ( !doc.exists ) {
      log.info( `${chalk.bgRedBright.black('ERROR:')} ${username} is not a valid streamer` );
      return;
    }

    let url: string;
    if ( transcoded ) {
      url = `https://${this.cdnServer}/${transcodeStream}/${username}.m3u8`;
    } else {
      url = `https://${this.cdnServer}/${hlsStream}/${username}/index.m3u8`;
    }

    await streamRef.update({
      url: url,
    });

    log.info( `${chalk.cyanBright(username)}'s transcoder has ${ transcoded ? chalk.greenBright.bold('started') : chalk.redBright.bold('stopped') }.` );
  };

  /**
   * Check streamer's archive setting
   * @param username - Streamer's username
   */
  async checkArchive( username: string ): Promise<boolean> {
    const streamRef = admin.firestore().collection( 'streams' ).doc( username.toLowerCase() );
    const doc = await streamRef.get();

    if ( !doc.exists ) {
      log.info( `${chalk.bgRedBright.black('ERROR:')} ${username} is not a valid streamer` );
      return;
    }

    const data = doc.data();
    return !!data.archive;
  }
}

export const streamAuth = config => new StreamAuth( config );
