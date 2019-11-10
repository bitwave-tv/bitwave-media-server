// Created by xander on 10/30/2019

'use strict';

// import logger from '../../classes/Logger';
// const webLogger = logger('webserver');

import * as admin from 'firebase-admin';
const serviceAccount = require('../../creds/service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://bitwave-7f415.firebaseio.com',
});

const hlsStream  = `hls`;
const transcodeStream = `transcode`;
const thumbnail  = `preview`;

class StreamAuth {
  private readonly hostServer: string;
  private readonly cdnServer: string;

  constructor( config ) {
    this.hostServer = config.hostServer;
    this.cdnServer = config.cdnServer;
  }

  /**
   * Retrieves a user's stream key if available
   * @param username - The user whose key to retrieve
   * @returns {Promise<*>} - Returns key if found, else null
   */
  async getStreamKey ( username: string ) {
    const streamRef = admin.firestore().collection('users').where('_username', '==', username.toLowerCase()).limit(1);
    const docs = await streamRef.get();
    if ( !docs.empty ) {
      const key = docs.docs[0].get( 'streamkey' );
      if ( !!key ) {
        return key; // User has a key
      }
      if ( key === undefined ) console.log(`${username} does not have a key! (undefined)`);
      else console.log(`\x1b[91mERROR:\x1b[0m ${username}'s key is invalid! ${key}`);
      return null;
    } else {
      console.log(`\x1b[91mERROR:\x1b[0m User \x1b[1m\x1b[36m${username}\x1b[0m could not be found!`);
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
      console.log(`\x1b[91mERROR:\x1b[0m ${username} did not provide a streamkey`);
      return false;
    }

    const streamKey = await this.getStreamKey( username );
    if ( !streamKey ) {
      // console.log(`\x1b[91mERROR:\x1b[0m ${username} does not have a stream key`);
      return false;
    }

    if ( key !== streamKey ) {
      console.log(`\x1b[91mDENIED:\x1b[0m ${username} supplied an invalid streamkey`);
      return false;
    }

    if ( key === streamKey ) {
      console.log(`\x1b[1m\x1b[32mSUCCES:\x1b[0m ${username} stream authorized`);
      return true;
    }

    console.log(`\x1b[91mERROR:\x1b[0m Unknown fail condiiton while attempting to authorize stream`);
    return false;
  };

  async setLiveStatus ( username: string, state: boolean, transcoded?: boolean ) {
    const _username = username.toLowerCase();
    const streamRef = admin.firestore().collection('streams').doc(_username);
    const doc = await streamRef.get();

    if ( !doc.exists ) {
      console.log(`ERROR: ${username} is not a valid streamer`);
      return;
    }

    let url: string;
    if ( transcoded ) {
      url = `https://${this.cdnServer}/${transcodeStream}/${username}.m3u8`;
    } else {
      url = `https://${this.cdnServer}/${hlsStream}/${username}/index.m3u8`;
    }

    await streamRef.update({
      live: state,
      url: url,
      thumbnail: `https://${this.cdnServer}/${thumbnail}/${username}.png`,
    });

    console.log(`\x1b[1m\x1b[36m${username}\x1b[0m is now \x1b[1m${ state ? '\x1b[32mLIVE' : '\x1b[91mOFFLINE' }\x1b[0m`);
  };
}

export const streamAuth = config => new StreamAuth( config );
