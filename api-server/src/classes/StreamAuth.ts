// Created by xander on 10/30/2019

'use strict';

import logger from './Logger';
const log = logger('AUTH');

import { serverData } from './ServerData';

import * as chalk from 'chalk';
import * as admin from 'firebase-admin';
import * as rp from 'request-promise';

// Do not attempt to log credentials for CI/CD pipeline
const CICD: boolean = process.env['CICD'] === 'true';
if ( !CICD ) {
  const serviceAccount = require('../../creds/service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert( serviceAccount ),
    databaseURL: 'https://bitwave-7f415.firebaseio.com',
  });
}

const hlsStream: string  = `hls`;
const transcodeStream: string = `transcode`;
const thumbnail: string  = `preview`;

class StreamAuth {
  private readonly hostServer: string;
  private readonly cdnServer: string;

  constructor( config ) {
    this.hostServer = config.hostServer;
    this.cdnServer  = config.cdnServer;
  }

  /**
   * Retrieves a user's stream key if available
   * @param {string} username - The user whose key to retrieve
   * @returns {Promise<string|null>} - Returns key if found, else null
   */
  async getStreamKey ( username: string ): Promise<string|null> {
    const streamRef = admin.firestore()
      .collection( 'users' )
      .where( '_username', '==', username.toLowerCase() )
      .limit( 1 );

    const docs = await streamRef.get();

    if ( !docs.empty ) {
      const key = docs.docs[0].get( 'streamkey' );

      if ( !!key ) return key; // User has a key

      if ( key === undefined )
        log.info( `${username} does not have a key! (undefined)` );
      else
        log.info( `${chalk.bgRedBright.black(' ERROR: ')} ${username}'s key is invalid! '${key}'` );

      return null;
    } else {
      log.info( `${chalk.bgRedBright.black(' ERROR: ')}  User ${chalk.bgYellowBright(username)} could not be found!` );
      return null;
    }
  };

  /**
   * Verify & Authorize a user's stream via streamkey
   * @param {string} username - name of user attempting to stream
   * @param {string} key - user's streamkey
   * @returns {Promise<boolean>} - Returns true if user's streamkey matches database
   */
  async checkStreamKey ( username: string, key: string ): Promise<boolean> {
    if ( !key ) {
      log.info( `${chalk.bgRedBright.black(' ERROR: ')} ${username} did not provide a stream key.` );
      return false;
    }

    const streamKey = await this.getStreamKey( username );
    if ( !streamKey ) {
      log.info(`${chalk.bgRedBright.black(' ERROR: ')} ${username} does not have a stream key` );
      return false;
    }

    if ( key !== streamKey ) {
      log.info( `${chalk.bgRedBright.black(' ERROR: ')} ${username} supplied an invalid stream key: '${key}'` );
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
   * @param {string} username - Streamer's username
   * @param {boolean} state - LIVE / OFFLINE status
   * @return {Promise<void>}
   */
  async setLiveStatus ( username: string, state: boolean ): Promise<void> {
    const streamRef = admin.firestore().collection( 'streams' ).doc( username.toLowerCase() );
    const doc = await streamRef.get();

    if ( !doc.exists ) {
      log.info( `${chalk.bgRedBright.black('ERROR:')} ${username} is not a valid streamer` );
      return;
    }

    const streamUrl = `https://${this.cdnServer}/${hlsStream}/${username}/index.m3u8`;
    const thumbUrl  = `https://${this.cdnServer}/${thumbnail}/${username}.jpg`;

    await streamRef.update({
      live: state,
      url: streamUrl,
      thumbnail: thumbUrl,
      rtmp: username,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    if ( state ) {
      serverData.addStreamer( username );
    } else {
      serverData.removeStreamer( username );
    }

    log.info( `${chalk.cyanBright(username)} is now ${ state ? chalk.greenBright.bold('LIVE') : chalk.redBright.bold('OFFLINE') }` );
  };

  /**
   * Set transcode status and livestream endpoint
   * @param {string} username - Streamer's username
   * @param {boolean} transcoded - Transcode status
   * @return {Promise<void>}
   */
  async setTranscodeStatus ( username: string, transcoded: boolean, location?: string ): Promise<void> {
    const streamRef = admin.firestore()
      .collection( 'streams' )
      .doc( username.toLowerCase() );

    const doc = await streamRef.get();

    if ( !doc.exists ) {
      log.info( `${chalk.bgRedBright.black('ERROR:')} ${username} is not a valid streamer` );
      return;
    }

    let url: string;
    if ( transcoded ) {
      // url = `https://${this.cdnServer}/${transcodeStream}/${username}.m3u8`;
      url = `https://${this.cdnServer}/${location}/${username}.m3u8`;
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
   * @param {string} username - Streamer's username
   * @return {Promise<boolean>}
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
  };

  /**
   * Passes archive information to API server
   * @param {string} username
   * @param {string} location
   * @param {number} duration
   * @param {Array<string>} thumbnails
   * @return {Promise<void>}
   */
  async saveArchive ( username: string, location: string, duration: number, thumbnails: string[] ): Promise<void> {
    const options = {
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      form: {
        server: this.hostServer,
        username: username,
        location: location,
        duration: duration,
        thumbnails: thumbnails,
      },
    };

    try {
      const response = await rp.post( 'https://api.bitwave.tv/v1/archives',  options );
      log.info( response );
    } catch ( error ) {
      log.info( error );
    }
  };

  /**
   * Returns user profile data for a given uid
   * @param uid
   */
  async getUserData ( uid: string ): Promise<FirebaseFirestore.DocumentData> {
    const userDocument = await admin.firestore()
      .collection( 'users' )
      .doc( uid )
      .get();
    return userDocument.data();
  }

  /**
   * Verifies user token & checks if user is admin
   * @param {FirebaseFirestore.DocumentData} data
   * @return {Promise<boolean>}
   */
  verifyAdmin ( data: FirebaseFirestore.DocumentData ): boolean {
    // Check if user has admin role
    return data.hasOwnProperty( 'role' )
      ? data.role === 'admin'
      : false;
  }

  /**
   * Verifies user token matches username
   * @param {FirebaseFirestore.DocumentData} data
   * @param {string} username
   * @return {Promise<boolean>}
   */
  verifyUser ( data: FirebaseFirestore.DocumentData, username: string ): boolean {
    // Check if username matches
    return data.hasOwnProperty( '_username' )
      ? data._username === username.toLowerCase()
      : false;
  }

  /**
   * Checks token and verifies user matches username or that they are an admin
   * @param {string} token
   * @param {string} username
   */
  async verifyToken ( token: string, username: string ): Promise<boolean> {
    // Require token
    if ( !token ) return false;

    // Verify token and get UID
    const { uid } = await admin.auth().verifyIdToken( token );

    // Get user data
    const data = await this.getUserData( uid );

    // Check if username matches token
    const userAuth = this.verifyUser( data, username );
    if ( userAuth ) return true;

    // Check if user is an admin
    const adminAuth = this.verifyAdmin( data );
    if ( adminAuth ) return true;

    // User was not verified, and is not an admin
    console.log( 'Token verification failed' );
    return false;
  }
}

export const streamAuth = config => new StreamAuth( config );
