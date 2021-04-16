// Created by xander on 3/19/2021
'use strict';

import logger from './Logger';
const log = logger('AUTH');

import { serverData } from './ServerData';

import * as chalk from 'chalk';
import * as rp from 'request-promise';

import * as admin from 'firebase-admin';
import { IArchiveTransmuxed } from './Archiver';

const hlsStream: string  = `hls`;
const transcodeStream: string = `transcode`;
const thumbnail: string  = `preview`;

const dbServerTimestamp = admin.firestore.FieldValue.serverTimestamp;

interface IClaimData {
  address: string;
  amount: string;
  canonical_url: string;
  claim_id: string;
  claim_op: string;
  confirmations: number;
  has_signing_key: boolean;
  height: number;
  meta: object;
  name: string;
  normalized_name: string;
  nout: number;
  permanent_url: string;
  short_url: string;
  timestramp: number;
  txid: string;
  type: string;
  value: object;
  value_type: string;
}

export default class OdyseeStream {
  private readonly hostServer: string;
  private readonly cdnServer: string;

  constructor( config ) {
    this.hostServer = config.hostServer;
    this.cdnServer  = config.cdnServer;
  }

  /**
   * Set streamer live status and transcode status
   * @param {string} claimId - Streamer's username
   * @param {boolean} isLive - LIVE / OFFLINE status
   * @return {Promise<void>}
   */
  async setLiveStatus ( claimId: string, isLive: boolean ): Promise<void> {
    // Reference to odysee stream document
    const streamRef = admin
      .firestore()
      .collection( 'odysee-streams' )
      .doc( claimId.toLowerCase() );

    const streamUrl = `https://${this.cdnServer}/${hlsStream}/${claimId}/index.m3u8`;
    const thumbUrl  = `https://${this.cdnServer}/${thumbnail}/${claimId}.jpg`;

    const claimIdData = await this.getClaimIdData( claimId );

    await streamRef.set({
      claimId: claimId,
      claimData: {
        _name: claimIdData.normalized_name,
        name: claimIdData.name,
        shortUrl: claimIdData.short_url,
        canonicalUrl: claimIdData.canonical_url,
        channelLink: claimIdData.short_url.replace( `lbry://`, `https://odysee.com/` ),
      },
      live: isLive,
      url: streamUrl,
      type: 'application/x-mpegurl',
      thumbnail: thumbUrl,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    if ( isLive ) {
      serverData.addStreamer( claimId, true );
    } else {
      serverData.removeStreamer( claimId );
    }

    log.info( `${chalk.cyanBright(claimId)} is now ${ isLive ? chalk.greenBright.bold('LIVE') : chalk.redBright.bold('OFFLINE') }` );
  };


  /**
   * Send live notification to API server
   * @param claimId
   * @return {Promise<boolean>}
   */
  async sendNotification ( claimId: string ): Promise<boolean> {
    log.info( `Sending odysee notification...` );

    // Odysee JSON RPC Payload
    const body = {
      claimId: claimId,
      key: process.env.SEVER_SECRET,
    };

    // Build Post Request Options
    const options = {
      headers: {
        'content-type': 'application/json',
      },
      json: true,
      body: body,
    };

    // Submit API request to Odysee API
    let response = undefined;
    try {
      response = await rp.post( 'https://api.bitwave.tv/v1/odysee/send-notification', options );
      // Log Odysee API request
      log.info( `SENT: ${JSON.stringify( body )}`,  )
      log.info( `RESPONSE: ${JSON.stringify( response )}` );

      return true;
    } catch ( error ) {
      log.info( 'Error during API call for notification' );
      log.error( error );

      return  false;
    }
  }

  /**
   * Set transcode status and livestream endpoint
   * @param {string} claimId - Streamer's claimId
   * @param {boolean} transcoded - Transcode status
   * @param {string?} location - Transcode location
   * @return {Promise<void>}
   */
  async setTranscodeStatus ( claimId: string, transcoded: boolean, location?: string ): Promise<void> {
    const streamRef = admin
      .firestore()
      .collection( 'odysee-streams' )
      .doc( claimId.toLowerCase() );

    const doc = await streamRef.get();

    if ( !doc.exists ) {
      log.info( `${chalk.bgRedBright.black('ERROR:')} ${claimId} is not a valid streamer` );
      return;
    }

    let url: string;
    if ( transcoded ) {
      // url = `https://${this.cdnServer}/${transcodeStream}/${username}.m3u8`;
      url = `https://${this.cdnServer}/${location}/${claimId}.m3u8`;
    } else {
      url = `https://${this.cdnServer}/${hlsStream}/${claimId}/index.m3u8`;
    }

    await streamRef.update({
      url: url,
    });

    log.info( `${chalk.cyanBright(claimId)}'s transcoder has ${ transcoded ? chalk.greenBright.bold('started') : chalk.redBright.bold('stopped') }.` );
  };

  /**
   * Check streamer's archive setting
   * @param {string} claimId - Streamer's claimId
   * @return {Promise<boolean>}
   */
  async checkArchive( claimId: string ): Promise<boolean> {
    const streamRef = admin
      .firestore()
      .collection( 'odysee-streams' )
      .doc( claimId.toLowerCase() );
    const doc = await streamRef.get();

    if ( !doc.exists ) {
      log.info( `${chalk.bgRedBright.black('ERROR:')} ${claimId} is not a valid streamer` );
      return;
    }

    const data = doc.data();
    return !!data.archive;
  };

  /**
   * Passes archive information to API server
   * @param {string} claimId
   * @param {IArchiveTransmuxed} archive
   * @return {Promise<void>}
   */
  async saveArchive ( claimId: string, archive: IArchiveTransmuxed ): Promise<void> {

    // TODO: Add vods.odysee.live to ENV vars
    const replaceDomain = src => src.replace( /(vods[.])?(sfo2[.]digitaloceanspaces[.]com)([/]vods)?/, 'vods.odysee.live' );

    const odyseeReplayDocument = {
      key: archive.key,
      claimId: claimId.toLowerCase(),
      service: 'odysee',
      fileLocation: replaceDomain( archive.file ),
      fileType: archive.type,
      fileDuration: archive.duration,
      fileSize: archive.fileSize,
      thumbnails: archive.thumbnails.map( url => replaceDomain( url ) ),
      deleted: false,
      published: false,
      uploadedAt: dbServerTimestamp(),
      deletedAt: null,
      publishedAt: null,
      ffprobe: archive.ffprobe,
    };

    // Reference to odysee stream document
    const odyseeReplayCollection = admin
      .firestore()
      .collection( 'odysee-replays' );

    const replayReference = await odyseeReplayCollection.add( odyseeReplayDocument );

    log.info( `Odysee replay added to odysee-replays as: ${replayReference.id}` );
  };

  /**
   * Verifies an odysee channel signed streamkey via signature
   * @param {string} claimId
   * @param {string} hexData
   * @param {string} signature
   * @param {string} signatureTs
   * @return {Promise<boolean>} valid
   */
  async verifySignature ( claimId: string, hexData: string, signature: string, signatureTs: string ): Promise<boolean> {
    // Odysee JSON RPC Method
    const rpcMethod = 'verify.Signature'

    // Odysee JSON RPC Payload
    const body = {
      jsonrpc: "2.0",
      method: rpcMethod,
      id: 0,
      params: {
        'channel_id': claimId,
        'signature': signature,
        'signing_ts': signatureTs,
        'data_hex': hexData,
      },
    };

    // Build Post Request Options
    const options = {
      headers: {
        'content-type': 'application/json',
      },
      json: true,
      body: body,
    };

    // Submit API request to Odysee API
    let response = undefined;
    try {
      response = await rp.post( 'https://comments.lbry.com/api/v2?m=verify.Signature', options );
      // Log Odysee API request
      log.info( `RESPONSE: ${JSON.stringify( response )}` );
    } catch ( error ) {
      log.info( 'Error during Odysee API call to validate channel sign!' );
      log.error( error );
      return  false;
    }

    // Process Odysee API Response
    if ( !response ) {
      log.info( chalk.redBright( `Odysee API response was empty (Odysee API Error)` ) );
      return false;
    }
    // Verified streamkey signature
    if ( response.result && response.result?.is_valid ) {
      log.info( chalk.greenBright( `Odysee signature verified!` ) );
      return true;
    }
    // Odysee API returned an error
    if ( response && response.error ) {
      log.info( chalk.redBright( `Invalid Odysee Signature: ${response.error?.message}` ) );
      return false;
    }
    // Malformed response
    log.info( chalk.redBright( `Odysee signature failed verification! (invalid Odysee API response)` ) );
    return false;
  }

  /**
   * Gets result from claim_search SDK for claimId
   * See: {@link https://lbry.tech/api/sdk#claim_search} for more info and options.
   * @param {string} claimId
   */
  async getClaimIdData ( claimId: string ): Promise<IClaimData|null> {
    // Odysee JSON RPC Method
    const method = 'claim_search'

    // Odysee JSON RPC Payload
    const body = {
      jsonrpc: '2.0',
      method: method,
      params: {
        'claim_id': claimId,
      },
    };

    // Build Post Request Options
    const options = {
      headers: { 'content-type': 'application/json' },
      json: true,
      body: body,
    };

    // Submit API request to Odysee API
    let response = undefined;
    try {
      response = await rp.post( 'https://api.lbry.tv/api/v1/proxy', options );
    } catch ( error ) {
      log.info( 'Error during Odysee API call to get claim id channel data!' );
      log.error( error );
      return  null;
    }

    if ( response.result.items?.length > 0 ) {
      return response.result.items[0];
    } else {
      log.info( `no results from claim search!` );
      return null;
    }
  }

  /**
   * Gets the most recent livestream claim data for a given channel's claim id
   * See: {@link https://lbry.tech/api/sdk#claim_search} for more info and options.
   * @param {string} channelClaimId
   */
  async getLivestreamClaimByChannelClaimId ( channelClaimId: string ): Promise<IClaimData|null> {
    // Odysee JSON RPC Method
    const method = 'claim_search'

    // Odysee JSON RPC Payload
    const body = {
      jsonrpc: '2.0',
      method: method,
      params: {
        // Channel's Claim ID
        claim_id: channelClaimId,

        // Constant search params
        has_no_source: true,
        order_by: 'release_time',
        no_totals: true
      },
    };

    // Build Post Request Options
    const options = {
      headers: { 'content-type': 'application/json' },
      json: true,
      body: body,
    };

    // Submit API request to Odysee API
    let response = undefined;
    try {
      response = await rp.post( 'https://api.lbry.tv/api/v1/proxy', options );
    } catch ( error ) {
      log.info( 'Error during Odysee API call to get claim id channel data!' );
      log.error( error );
      return  null;
    }

    if ( response.result.items?.length > 0 ) {
      return response.result.items[0];
    } else {
      log.info( `no results from claim search!` );
      return null;
    }
  }
}
