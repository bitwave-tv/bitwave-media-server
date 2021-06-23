// Created by xander on 10/30/2019

'use strict';
import { Request, Router } from 'express';
import * as chalk from 'chalk';
import * as rp from 'request-promise';
import Timeout = NodeJS.Timeout;

import logger from '../../classes/Logger';
const apiLogger = logger( 'APIv1' );

import { streamAuth } from '../../classes/StreamAuth';
export const streamauth = streamAuth({
  hostServer : process.env['BMS_SERVER'] || 'stream.bitrave.tv',
  cdnServer  : process.env['BMS_CDN']    || 'cdn.stream.bitrave.tv',
});

import OdyseeStream from '../../classes/OdyseeStream';
const odyseeStream = new OdyseeStream({
  hostServer : 'stream.odysee.com',
  cdnServer  : 'cdn.odysee.live',
});

import { serverData } from '../../classes/ServerData';
import { hlsRelay }   from '../../classes/Relay';
import { transcoder } from '../../classes/Transcoder';
import { restreamer } from '../../classes/Restream';
import { archiver }   from '../../classes/Archiver';

import {
  authenticatedRequest,
  extractToken,
  validate,
  validateUserToken
} from '../middleware/auth';
import { fromHex } from '../../services/hex';

const port    = '5000';
const server  = 'nginx-server';
const host    = `http://${server}:${port}`;
const control = 'control';

interface ILiveTimer {
  user: string;
  timer: Timeout;
}

let liveTimers: ILiveTimer[] = [];
const updateDelay: number    = 15; // 15 seconds

let notificationTimers: ILiveTimer[] = [];
const notificationDelay: number      = 60; // 60 seconds

const router = Router();

/*********************************
 * Authorize Streams
 */

/**
 * Authorize livestream
 */
router.post(
  '/stream/authorize',

  async ( req, res ) => {
    const app  = req.body.app;
    const name = req.body.name;
    const key  = req.body.key;

    if ( !app ) return res.status( 404 ).send( `Invalid route for authorization` );

    // Check if we need to check streamkey
    if ( app !== 'live' ) return res.status( 200 ).send( `${[app]} Auth not required` );

    // block new connections if user is already connected
    const streamer = serverData.getStreamer( name );
    if ( streamer ) {
      // Streamer Data
      let streamerData = serverData.getStreamerData( name );

      // Odysee streams
      if ( streamerData && streamerData.isOdysee ) {
        apiLogger.error( `Odysee Streamer '${name}' is already connected!` );
      } else {
        apiLogger.error( `Streamer '${name}' is already connected! Denying new connection.` );
        return res
          .status( 403 )
          .send( `Another stream is already in progress.` );
      }
    }


    //------------------------------------------------
    // Detect Odysee Stream
    const hexData = req.body.d;
    const signature = req.body.s;
    const signatureTs = req.body.t;

    if ( hexData && signature && signatureTs ) {
      // Verify Odysee stream key
      const odyseeValidKey = await odyseeStream.verifySignature(name, hexData, signature, signatureTs);

      if ( odyseeValidKey ) {
        const channel = fromHex( hexData );
        apiLogger.info(`Odysee StreamKey for ${channel} is valid. [200]`)
        res
          .status( 200 )
          .send( `${name} authorized.` );

        // Relay stream to HLS endpoint
        const relaySuccessful: boolean = await hlsRelay.startRelay( name );

        // Verify we were able to start the HLS ffmpeg process
        if ( !relaySuccessful ) {
          apiLogger.error( `[${channel}] Failed to start HLS relay` );
          return;
        }

        // Set stream as LIVE in database
        const liveTimer = setTimeout( async() => await odyseeStream.setLiveStatus( name, true ), updateDelay * 1000 );
        liveTimers.push({
          user: name,
          timer: liveTimer,
        });

        apiLogger.info( `Start recording Odysee stream.` );


        //------------------------------------------------
        // Start stream archive
        const attempts = 5;
        const interval = 5;
        let response;
        for ( let i: number = 0; i <= attempts; i++ ) {

          // Start recording odysee replay streams automatically
          response = await archiver.startArchive( name, 'odysee' );

          // Check if replay  started successfully
          if ( !response ) {
            // Archive failed to start, wait, then try again.
            await new Promise( resolve => setTimeout( resolve, 1000 * interval ) );
            apiLogger.info( `${chalk.redBright('Failed to start archive')}, attempting again in ${interval} seconds (${i}/${attempts})` );
            if ( i === attempts ) apiLogger.info( `${chalk.redBright('Giving up on archive.')} (out of attempts)` );
          } else {
            apiLogger.info( `Archiving ${chalk.cyanBright.bold(name)} to: ${chalk.greenBright(response)}` );
            break;
          }
        }
        //------------------------------------------------


        apiLogger.info( `Odysee auth process complete.` );

        return;
      } else {
        apiLogger.info(`Odysee StreamKey for ${name} is invalid. [403]`)
        res
          .status( 403 )
          .send( `${name} denied.` );
        return;
      }
    }
    //------------------------------------------------


    // The following code only runs on the live endpoint
    // and requires both a name & key to authorize publish
    if ( !name ) {
      apiLogger.error( `Stream authorization missing username.` );
      return res
        .status( 422 )
        .send(`Authorization missing username.`);
    }
    if ( !key ) {
      apiLogger.error( `[${name}] Stream authorization missing key` );
      return res
        .status( 422 )
        .send( `Missing authorization key` );
    }

    // Verify stream key
    const checkKey: boolean = await streamauth.checkStreamKey ( name, key );

    if ( !checkKey ) {
      return res
        .status( 403 )
        .send( `${name} denied.` );
    }

    /**
     * Respond as quickly as possible to the client while
     * the server continues to process the connection.
     */
    // We are authorized
    res
      .status( 200 )
      .send( `${name} authorized.` );


    // Relay stream to HLS endpoint
    const relaySuccessful: boolean = await hlsRelay.startRelay( name );

    // Verify we were able to start the HLS ffmpeg process
    if ( !relaySuccessful ) {
      apiLogger.error( `[${name}] Failed to start HLS relay` );
      return;
    }

    // If authorized, pre-fetch archive status
    const checkArchive: boolean = await streamauth.checkArchive( name );

    // Wait for a few seconds before updating state and starting archive
    const timer: Timeout = setTimeout( async () => {

      // Update live status
      await streamauth.setLiveStatus( name, true );

      // Check if we should archive stream
      if ( !checkArchive ) {
        apiLogger.info( `Archiving is disabled for ${chalk.cyanBright.bold(name)}` );
        return;
      }

      // Start stream archive
      const attempts = 5;
      let response;
      for ( let i: number = 0; i <= attempts; i++ ) {

        // response = await rp( `${host}/${control}/record/start?app=live&name=${name}&rec=archive` );
        response = await archiver.startArchive( name, 'replay' );

        if ( !response ) {
          await new Promise( resolve => setTimeout( resolve, 1000 * 10 ) );
          apiLogger.info( `${chalk.redBright('Failed to start archive')}, attempting again in 10 seconds (${i}/${attempts})` );
          if ( i === attempts ) apiLogger.info( `${chalk.redBright('Giving up on archive.')} (out of attempts)` );
        } else {
          apiLogger.info( `Archiving ${chalk.cyanBright.bold(name)} to: ${chalk.greenBright(response)}` );
          break;
        }
      }
    }, updateDelay * 1000 );

    liveTimers.push({
      user: name,
      timer: timer,
    });

  },
);


/**
 * Publish HLS stream, send notifications
 */
router.post(
  '/stream/publish',

  async ( req, res ) => {
    const app  = req.body.app;  // Always HLS
    const name = req.body.name; // Stream name

    // Basic sanity check
    if ( app !== 'hls' ) return res.status(404).send(`Unknown stream endpoint ${app}.`);

    if ( name ) {
      const timer: Timeout = setTimeout( async () => {
        apiLogger.info(`[${app}] ${chalk.cyanBright.bold(name)} is now ${chalk.greenBright.bold('sending notification request')}.`);

        // Send notifications
        const options = { form: { streamer: name } };
        try {
          // Get streamer data (used to detect Odysee streams)
          let streamer = serverData.getStreamerData( name );

          // Odysee streams
          if ( streamer && streamer.isOdysee ) {
            await odyseeStream.sendNotification( name );
          }
          // Bitwave (non-odysee) streams
          else {
            await rp.post( 'https://api.bitwave.tv/api/notification/live', options );
          }
        } catch ( error ) {
          console.error( `Send notification failed: ${error.message}` );
        }

        // remove finished LIVE timer
        liveTimers = liveTimers.filter( val => val.user.toLowerCase() !== name.toLowerCase() );
      }, notificationDelay * 1000 );

      notificationTimers.push({
        user: name.toLowerCase(),
        timer: timer,
      });
    }

    apiLogger.info(`[${app}] ${chalk.cyanBright.bold(name)} is now ${chalk.greenBright.bold('PUBLISHED')}.`);
    res.send( `[${name}] Published ${name}.` );
  },
);


/**
 * Livestream disconnect
 */
router.post(
  '/stream/end',

  async ( req, res ) => {
    const app  = req.body.app;
    const name = req.body.name;

    // Streamer has  fully disconnected
    if ( app === 'live' || app === 'hls' ) {

      // Prevent live timers from firing if we go offline
      liveTimers = liveTimers
        .filter( val => {
          if ( val.user.toLowerCase() === name.toLowerCase() ) {
            clearTimeout( val.timer );
            return false;
          }
          return true;
        });

      // Prevent notifications timers from firing if we go offline too soon
      notificationTimers = notificationTimers
        .filter( val => {
          if ( val.user.toLowerCase() === name.toLowerCase() ) {
            clearTimeout( val.timer );
            return false;
          }
          return true;
        });


      // Get streamer data (used to detect Odysee streams)
      let streamer = serverData.getStreamerData( name );

      //---------------------------------------------------
      // Bitwave (non-odysee) streams
      if ( !streamer || !streamer.isOdysee ) {
        // Set offline status
        apiLogger.info(`Setting DB live state to false for: ${name}`);
        await streamauth.setLiveStatus( name, false );
      }
      //---------------------------------------------------

      //---------------------------------------------------
      // Odysee streams
      if ( streamer && streamer.isOdysee ) {
        apiLogger.info(`Setting DB live state to false for odysee stream: ${name}`);
        await odyseeStream.setLiveStatus( name, false );
      }
      //---------------------------------------------------

      res.send( `[${app}] ${name} is now OFFLINE` );
    }
  },
);



/**
 * Transcoded stream start
 */
router.post(
  '/stream/transcode/publish',

  async ( req, res ) => {
    const user = req.body.user;
    const app  = req.body.app;
    const name = req.body.name;

    apiLogger.info( `transcode/publish::user - ${user}` );
    apiLogger.info( `transcode/publish::app - ${app}` );
    apiLogger.info( `transcode/publish::name - ${name}` );

    if ( user ) {
      // Get streamer data (used to detect Odysee streams)
      const streamer = serverData.getStreamerData( user );

      const timer: Timeout = setTimeout( async () => {

        // Update stream after transcoder started

        //---------------------------------------------------
        // Bitwave (non-odysee) streams
        if ( !streamer || !streamer.isOdysee ) {
          await streamauth.setTranscodeStatus( user, true, app );
        }
        //---------------------------------------------------

        //---------------------------------------------------
        // Odysee streams
        if ( streamer && streamer.isOdysee ) {
          await odyseeStream.setTranscodeStatus( user, true, app );
        }
        //---------------------------------------------------

        apiLogger.info(`[${app}] ${chalk.cyanBright.bold(user)} is now ${chalk.greenBright.bold('transcoded')}.`);

        // remove timer
        liveTimers = liveTimers.filter( val => {
          return val.user !== `${name.toLowerCase()}-transcoder`;
        });
      }, updateDelay * 1000 );


      liveTimers.push({
        user: `${name.toLowerCase()}-transcoder`,
        timer: timer,
      });
    }

    res.send( `[${name}] is transcoding ${user}.` );
  },
);

/**
 * Transcoded stream done
 */
router.post(
  '/stream/transcode/end',

  async ( req, res ) => {
    const user = req.body.user;
    const app  = req.body.app;
    const name = req.body.name;

    if ( user ) {
      // Get streamer data (used to detect Odysee streams)
      const streamer = serverData.getStreamerData( user );

      // Update stream after transcoder started
      apiLogger.info(`[${app}] ${chalk.cyanBright.bold(user)} has disconnected from ${chalk.redBright.bold('transcoder')}.`);

      // Prevent live timers from firing if we go offline
      liveTimers.map( val => {
        if ( val.user === `${name.toLowerCase()}-transcoder` )
          clearTimeout( val.timer );
        else
          return val;
      });

      // remove timer
      liveTimers = liveTimers.filter( val => {
        return val.user !== `${name.toLowerCase()}-transcoder`;
      });
    }
    res.send( `[${name}] is NOT transcoding ${user}.` );
  },
);




/*********************************
 * Commands & Controls
 */


// Add Authenticating middleware
/*router.use(
  [
    '/transcoder',
    '/recorder',
    'restreamer',
    '/admin',
  ],
  validateUserToken(),
  validate,
  authenticatedRequest,
);*/

/**
 * Start transcoding stream
 */
router.post(
  '/transcoder/start',

  extractToken,
  validateUserToken(),
  validate,
  authenticatedRequest,

  async ( req, res ) => {
    const user = req.body.user;
    const enable144p = req.body.enable144p ?? false;
    const enable480p = req.body.enable480p ?? true;

    apiLogger.info( `transcode/start: ${user}` );
    apiLogger.info( `transcode/144p: ${enable144p}` );
    apiLogger.info( `transcode/480p: ${enable480p}` );

    // Attempt to get case sensitive username
    let streamer = serverData.getStreamer( user );

    // Failed to find user on server
    if ( !streamer ) {
      apiLogger.info( `${chalk.redBright( user )} not found - failed to transcode...` );
      // streamer = user;

      return res.send({
        message: `${streamer} is not connected.`,
        data: {
          streamer: streamer,
          user: user,
          enable144p: enable144p,
          enable480p: enable480p,
        }
      });
    }

    // User found - Start transcoding
    apiLogger.info( `${chalk.cyanBright.bold( streamer )} will be transcoded... Starting transcoders...` );
    transcoder.startTranscoder( streamer, enable144p, enable480p );

    res.send({
      message: `${streamer} is now being transcoded.`,
      data: streamer,
    });
  },
);

/**
 * Stop transcoding stream
 */
router.post(
  '/transcoder/stop',

  extractToken,
  validateUserToken(),
  validate,
  authenticatedRequest,

  async ( req, res ) => {
    const user = req.body.user;

    // Attempt to get case sensitive username
    let streamer = serverData.getStreamer( user );

    // Failed to find user on server
    if ( !streamer ) {
      apiLogger.info( `${chalk.redBright( user)} not found - failed to stop transcode...` );
      streamer = user;
    }

    // Stop transcoding
    apiLogger.info( `${chalk.cyanBright.bold(streamer)} will no longer be transcoded.` );

    // Revert streamer endpoint for any matching streamer, bitwave or odysee
    await odyseeStream.setTranscodeStatus( streamer, false );
    await streamauth.setTranscodeStatus( streamer, false );

    apiLogger.info( `${chalk.cyanBright.bold( streamer )}'s endpoint has been reverted` );

    // Stop transcode ffmpeg process
    transcoder.stopTranscoder( streamer );
    apiLogger.info( `${chalk.cyanBright.bold( streamer )}'s transcoding process has been stopped.` );

    res.send({
      message: `${ streamer } is no longer being transcoded.`,
      data: streamer,
    });
  },
);

//-------------------------------

/**
 * Start stream recorder
 */
router.post(
  '/recorder/start',

  extractToken,
  validateUserToken(),
  validate,
  authenticatedRequest,

  async ( req, res ) => {
    const user = req.body.user;

    // Attempt to get case sensitive username
    const streamer = serverData.getStreamer( user );

    // Failed to find user on server
    if ( !streamer ) {
      apiLogger.info( `${chalk.redBright( user)} failed to transcode... ( not found )` );
      return res.status( 200 ).send( `Could not find ${user} in the livestream list.` );
    }

    // Start archiving process
    // const response = await rp( `${host}/${control}/record/start?app=live&name=${streamer}&rec=archive` );
    const response = await archiver.startArchive( streamer, 'replay' );

    // Send response
    if ( !response ) {
      apiLogger.info(`${chalk.redBright('Failed to start archive')}, please try again.`);
    } else {
      apiLogger.info(`Archiving ${chalk.cyanBright.bold(streamer)} to ${chalk.greenBright(response)}`);
    }

    res.status( 200 ).send( !!response ? `Started recording: ${streamer}` : `${streamer} failed to start archive` );
  },
);

/**
 * Stop stream recorder
 */
router.post(
  '/recorder/stop',

  extractToken,
  validateUserToken(),
  validate,
  authenticatedRequest,

  async ( req, res ) => {
    const user = req.body.user;

    // Attempt to get case sensitive username
    const streamer = serverData.getStreamer( user );

    // Failed to find user on server
    if ( !streamer ) {
      apiLogger.info( `${chalk.redBright( user)} failed to transcode... ( not found )` );
      return res.status( 200 ).send( `Could not find ${user} in the livestream list.` );
    }

    // Stop archiving process
    // const response = await rp( `${host}/${control}/record/stop?app=live&name=${streamer}&rec=archive` );
    const response = await archiver.stopArchive( streamer, 'replay' );

    // Send response
    if ( !response ) {
      apiLogger.info(`${chalk.redBright('Failed to stop archive')}, please try again.` );
    } else {
      apiLogger.info(`Stopped recording ${chalk.cyanBright.bold(streamer)}`);
    }

    res.status( 200 ).send( !!response ? `Stopped recording ${streamer}` : `${streamer} failed to stop archive` );
  },
);

//-------------------------------

/**
 * Start restreaming process
 * Protected route
 */
router.post(
  '/restreamer/start',

  extractToken,
  validateUserToken(),
  validate,
  authenticatedRequest,

  async ( req, res ) => {
    const user   = req.body.user;
    const server = req.body.server;
    const key    = req.body.key;

    if (
      server.includes('stream.bitwave.tv') ||
      server.includes('stream.bitrave.tv')
    ) {
      apiLogger.info( `Denied circular restreaming attempt.` );
      return res.send( `Denied Restream Attempt.` );
    }

    // Attempt to get case sensitive username
    let streamer = serverData.getStreamer( user );

    // Failed to find user on server
    if ( !streamer ) {
      apiLogger.info( `${chalk.redBright( user)} failed to restream... ( not found )` );
      streamer = user;
    }

    // User found - Verify server & key
    if ( !server || !key ) {
      apiLogger.info( `${chalk.redBright( user)} missing restream server or key... ( not found )` );
      return res.send( `Could not find target restream server and / or key for ${user}.` );
    }

    // Start restreaming process
    apiLogger.info( `${chalk.cyanBright.bold( streamer )} Starting restreamer...` );
    await restreamer.startRestream( streamer, server, key );

    res.send( `${streamer} is now being restreamed` );
  },
);

/**
 * Stop restreaming process
 * Protected route
 */
router.post(
  '/restreamer/stop',

  extractToken,
  validateUserToken(),
  validate,
  authenticatedRequest,

  async ( req, res ) => {
    const user = req.body.user;

    // Attempt to get case sensitive username
    let streamer = serverData.getStreamer( user );

    // Failed to find user on server
    if ( !streamer ) {
      apiLogger.info( `${chalk.redBright( user)} failed to restream... ( not found )` );
      streamer = user;
    }

    // Stop restreaming process
    apiLogger.info( `${chalk.cyanBright.bold( streamer )}'s restreaming process has been stopped.` );
    await restreamer.stopRestream( streamer );

    res.send( `${streamer} is no longer being restreamed` );
  },
);


//------------------------------

/**
 * Restreamer stats
 * Protected route
 */
router.get(
  '/restreamer/stats',

  extractToken,
  validateUserToken(),
  validate,
  authenticatedRequest,

  async (req, res ) => {
    const data = restreamer.restreams.map( t => ({
      user: t.user,
      ffmpegProc: t.process?.ffmpegProc,
      ffprobeData: t.process?._ffprobeData,
      data: t.data
    }));

    res.send( data );
  },
);


/**
 * Restreamer user stat
 * Protected route
 */
router.get(
  '/restreamer/stats/:user',

  extractToken,
  validateUserToken(),
  validate,
  authenticatedRequest,

  async (req, res ) => {
    const data = restreamer.restreams
      .filter( stats =>
        stats.user.toLowerCase() === req.params.user.toLowerCase()
      )
      .map( stats =>
        ( { user: stats.user, ffmpegProc: stats.process?.ffmpegProc, data: stats.data } )
      );

    res.send(
      restreamer.restreams
        .filter( stats => {
          if ( stats.user.toLowerCase() === req.params.user.toLowerCase() )
            return { user: stats.user, data: stats.data }
        })
    );
  },
);



//-------------------------------



/*********************************
 * Stream Data
 */

/**
 * HLS stream stats
 */
router.get(
  '/streamer/stats',
  async ( req, res ) => {
    const data = hlsRelay.transcoders.map( t => ({
      user: t.user,
      ffmpegProc: t.process?.ffmpegProc,
      ffprobeData: t.process?._ffprobeData,
      data: t.data
    }));

    res.send( data );
  },
);



/**
 * HLS stream stats for single user
 */
router.get(
  '/streamer/stats/:user',
  async ( req, res ) => {
    const data = hlsRelay.transcoders
      .filter( stats => stats.user.toLowerCase() === req.params.user.toLowerCase() )
      .map( stats => ({user: stats.user, ffmpegProc: stats.process?.ffmpegProc, data: stats.data }) );

    res.send(
      hlsRelay.transcoders
        .filter( stats => {
        if ( stats.user.toLowerCase() === req.params.user.toLowerCase() )
          return { user: stats.user, data: stats.data }
        })
    );
  },
);



//------------------------------

/**
 * Transcoded stream stats
 */
router.get(
  '/transcoder/stats',
  async (req, res ) => {
    const data = transcoder.transcoders.map( t => ({
      user: t.user,
      ffmpegProc: t.process?.ffmpegProc,
      ffprobeData: t.process?._ffprobeData,
      data: t.data
    }));

    res.send( data );
  },
);

router.get(
  '/transcoder/stats/:user',
  async (req, res ) => {
    const data = transcoder.transcoders
      .filter( stats => stats.user.toLowerCase() === req.params.user.toLowerCase() )
      .map( stats => ({user: stats.user, ffmpegProc: stats.process?.ffmpegProc, data: stats.data }) );

    res.send(
      transcoder.transcoders
        .filter( stats => {
          if ( stats.user.toLowerCase() === req.params.user.toLowerCase() )
            return { user: stats.user, data: stats.data }
        })
    );
  },
);



/*********************************
 * Server Data
 */

router.get(
  '/server/data',
  async ( req, res ) => {
    const data = serverData.getStreamerList();
    res.send( data );
  },
);

router.get(
  '/server/data/:streamer',
  async ( req, res ) => {
    const streamer = req.params.streamer;
    const data = serverData.getStreamerData( streamer );

    // Verify we got data
    if ( !data ) return res.status( 404 ).send( 'Error: streamer not found' );

    // Update streamer's data
    // serverData.updateStreamer( streamer ); // Prevent potential DDoS

    // Send results
    res.send( data );
  },
);



/*********************************
 * Archive Commands
 */

// Convert flv -> mp4, generate thumbnails, and save to database
router.post(
  '/archive/end',

  async ( req, res ) => {
    const channel = req.body.channel;
    const service = req.body.service;
    const result  = req.body.result;

    console.log( `Saving replay for ${channel} on ${service}:\n` );

    // Save archive via bitwave API
    if ( service === 'bitwave' ) {
      await streamauth.saveArchive( channel, result.file, result.duration, result.thumbnails );
      console.log( `Saved bitwave replay` );
    }

    // Save archive via odysee API
    if ( service === 'odysee' ) {
      await odyseeStream.saveArchive( channel, result );
      console.log( `Saved odysee replay` );
    }

    return res.send();
  },
);

// Delete archive file & reference
router.delete(
  '/archive/:archiveId',

  extractToken,
  validateUserToken(),
  validate,
  authenticatedRequest,

  async ( req, res ) => {
    const archiveId = req.params.archiveId;
    const result = await archiver.deleteArchive( archiveId );
    res.send( result );
  },
);



/*********************************
 * Admin Commands
 */
type reqWithToken = Request & { token: string };

router.post(
  '/admin/drop',

  // Backwards compatibility
  ( req, res, next ) => {
    req.body.user = req.body.user || req.body.streamer;
    next();
  },

  extractToken,
  validateUserToken(),
  validate,
  authenticatedRequest,

  async ( req, res ) => {
    // Get data from body with backwards compatibility
    const user  = req.body.user;
    const token = req.body.token;

    // Get exact streamer endpoint
    const name = serverData.getStreamer( user );

    // Check if streamer was found
    if ( !name ) console.warn( `${user} is not live, will attempt to force anyways.` );

    // Construct command
    const mode = 'drop', type = 'publisher', app  = 'live';
    const response = await rp( `${host}/${control}/${mode}/${type}?app=${app}&name=${name || user}` );

    if ( JSON.parse( response ) === 0 ) {
      apiLogger.info( `${name} user appears to be stuck...` );

      // Set offline status
      await streamauth.setLiveStatus( name, false );

      apiLogger.info( `${name} forced ${chalk.redBright('OFFLINE')}...` );
    }

    // Log results
    apiLogger.info( `Drop ${name} result: ${response}` );

    // Return result
    await res.send( response );
  },
);

export default router;
