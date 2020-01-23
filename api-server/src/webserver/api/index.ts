// Created by xander on 10/30/2019

'use strict';
import {Request, Router} from 'express';
import * as chalk from 'chalk';
import * as rp from 'request-promise';
import Timeout = NodeJS.Timeout;

import logger from '../../classes/Logger';
const apiLogger = logger( 'APIv1' );

import { streamAuth } from '../../classes/StreamAuth';
const streamauth = streamAuth({
  hostServer : process.env['BMS_SERVER'] || 'stream.bitrave.tv',
  cdnServer  : process.env['BMS_CDN']    || 'cdn.stream.bitrave.tv',
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

const port    = '5000';
const server  = 'nginx-server';
const host    = `http://${server}:${port}`;
const control = 'control';

interface ILiveTimer {
  user: string;
  timer: Timeout;
}

let liveTimers: ILiveTimer[] = [];
const updateDelay: number    = 10; // 10 seconds

let notificationTimers: ILiveTimer[] = [];
const notificationDelay: number     = 60; // 60 seconds

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
      apiLogger.error( 'Streamer is already connected! denying new connection' );
      return res.status( 500 ).send( `[${name}] Failed to start HLS ffmpeg process` );
    }

    // The following code only runs on the live endpoint
    // and requires both a name & key to authorize publish
    if ( !name || !key ) {
      apiLogger.error( `Stream authorization missing name or key` );
      return res.status( 422 ).send(`Authorization needs bother name and key`);
    }

    // Verify stream key
    const checkKey: boolean = await streamauth.checkStreamKey ( name, key );

    if ( checkKey ) {
      // We are authorized

      // Relay stream to HLS endpoint
      const relaySuccessful: boolean = hlsRelay.startRelay( name );

      // Verify we were able to start the HLS ffmpeg process
      if ( !relaySuccessful ) {
        apiLogger.error( `Failed to start HLS relay` );
        return res.status( 500 ).send( `[${name}] Failed to start HLS ffmpeg process` );
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
        const attempts = 3;
        let response;
        for ( let i: number = 0; i <= attempts; i++ ) {
          response = await rp( `${host}/${control}/record/start?app=live&name=${name}&rec=archive` );
          if ( !response ) {
            await new Promise( resolve => setTimeout( resolve, 1000 * 10 ) );
            apiLogger.info( `${chalk.redBright('Failed to start archive')}, attempting again in 10 seconds (${i}/${attempts})` );
            if ( i === attempts ) apiLogger.info( `${chalk.redBright('Giving up on archive.')} (out of attempts)` );
          } else {
            apiLogger.info( `Archiving ${chalk.cyanBright.bold(name)} to ${chalk.greenBright(response)}` );
            await streamauth.saveArchive( name, response );
            break;
          }
        }
      }, updateDelay * 1000 );

      liveTimers.push({
        user: name,
        timer: timer,
      });

      res
        .status( 200 )
        .send( `${name} authorized.` );
    } else {
      res
        .status( 403 )
        .send( `${name} denied.` );
    }
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
        await rp.post( 'https://api.bitwave.tv/api/notification/live', options );
      }, notificationDelay * 1000 );

      notificationTimers.push({
        user: name,
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
    if ( app === 'live' ) {

      // Prevent live timers from firing if we go offline
      liveTimers.map( val => {
        if ( val.user === name )
          clearTimeout( val.timer );
        else
          return val;
      });

      // Prevent notifications timers from firing if we go offline too soon
      notificationTimers.map( val => {
        if ( val.user === name )
          clearTimeout( val.timer );
        else
          return val;
      });

      // Set offline status
      await streamauth.setLiveStatus( name, false );

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

    if ( user ) {
      const timer: Timeout = setTimeout( async () => {
        await streamauth.setTranscodeStatus( user, true );
        apiLogger.info(`[${app}] ${chalk.cyanBright.bold(user)} is now ${chalk.greenBright.bold('transcoded')}.`);
      }, updateDelay * 1000 );


      liveTimers.push({
        user: `${name}-transcoder`,
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
      apiLogger.info(`[${app}] ${chalk.cyanBright.bold(user)} has disconnected from ${chalk.redBright.bold('transcoder')}.`);

      // Prevent live timers from firing if we go offline
      liveTimers.map( val => {
        if ( val.user === `${name}-transcoder` )
          clearTimeout( val.timer );
        else
          return val;
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

    // Attempt to get case sensitive username
    let streamer = serverData.getStreamer( user );

    // Failed to find user on server
    if ( !streamer ) {
      apiLogger.info( `${chalk.redBright( user )} not found - failed to transcode...` );
      streamer = user;
    }

    // User found - Start transcoding
    apiLogger.info( `${chalk.cyanBright.bold( streamer )} will be transcoded... Starting transcoders...` );
    transcoder.startTranscoder( streamer );

    res.send( `${streamer} is now being transcoded.` );
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

    // Revert streamer endpoint
    await streamauth.setTranscodeStatus( streamer, false );
    apiLogger.info( `${chalk.cyanBright.bold( streamer )}'s endpoint has been reverted` );

    // Stop transcode ffmpeg process
    transcoder.stopTranscoder( streamer );
    apiLogger.info( `${chalk.cyanBright.bold( streamer )}'s transcoding process has been stopped.` );

    res.send(`${ streamer } is no longer being transcoded.`);
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
    const response = await rp( `${host}/${control}/record/start?app=live&name=${streamer}&rec=archive` );

    // Send response
    if ( !response ) {
      apiLogger.info(`${chalk.redBright('Failed to start archive')}, please try again.`);
    } else {
      apiLogger.info(`Archiving ${chalk.cyanBright.bold(streamer)} to ${chalk.greenBright(response)}`);
      await streamauth.saveArchive( streamer, response );
    }

    res.status( 200 ).send( !!response ? response : `${streamer} failed to start archive` );
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
    const response = await rp( `${host}/${control}/record/stop?app=live&name=${streamer}&rec=archive` );

    // Send response
    if ( !response ) {
      apiLogger.info(`${chalk.redBright('Failed to stop archive')}, please try again.` );
    } else {
      apiLogger.info(`Archive of ${chalk.cyanBright.bold(streamer)} saved to ${chalk.greenBright(response)}`);
    }

    res.status( 200 ).send( !!response ? response : `${streamer} failed to stop archive` );
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
    serverData.updateStreamer( streamer );

    // Send results
    res.send( data );
  },
);



/*********************************
 * Archive Commands
 */

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
    const user = req.body.user;
    const token    = req.body.token;

    // Get exact streamer endpoint
    const name = serverData.getStreamer( user );

    // Check if streamer was found
    if ( !name ) console.warn( `${user} is not live, will attempt to force anyways.` );

    // Construct command
    const mode = 'drop', type = 'publisher', app  = 'live';
    const response = await rp( `${host}/${control}/${mode}/${type}?app=${app}&name=${name || user}` );

    // Log results
    apiLogger.info( `Drop ${name} result: ${response}` );

    // Return result
    await res.send( response );
  },
);

export default router;
