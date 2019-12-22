// Created by xander on 10/30/2019

'use strict';

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

const port    = '5000';
const server  = 'nginx-server';
const host    = `http://${server}:${port}`;
const control = 'control';

interface ILiveTimer {
  user: string;
  timer: Timeout;
}

let liveTimers: ILiveTimer[] = [];
const updateDelay: number    = 10;

export default app => {

  /*********************************
   * Authorize Streams
   */

  /**
   * Authorize livestream
   */
  app.post( '/stream/authorize', async ( req, res ) => {
    const app  = req.body.app;
    const name = req.body.name;
    const key  = req.body.key;

    if ( !app ) return res.sendStatus( 404 );

    // Check if we need to check streamkey
    if ( app !== 'live' ) return res.status( 200 ).send( `${[app]} Auth not required` );


    // The following code only runs on the live endpoint
    // and requires both a name & key to authorize publish
    if ( !name || !key ) return res.sendStatus( 500 );

    // Verify stream key
    const checkKey: boolean = await streamauth.checkStreamKey ( name, key );

    if ( checkKey ) {
      // We are authorized

      // Relay stream to HLS endpoint
      const relaySuccessful: boolean = hlsRelay.startRelay( name );

      // Verify we were able to start the HLS ffmpeg process
      if ( !relaySuccessful ) return res.status( 500 ).send( `[${name}] Failed to start HLS ffmpeg process` );

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

      apiLogger.info( `[${app}] ${chalk.cyanBright.bold(name)} authorized.` );

      res.status( 200 ).send( `${name} authorized.` );

    } else {
      apiLogger.info( `[${app}] ${chalk.redBright.bold(name)} denied.` );

      res.status( 403 ).send( `${name} denied.` );

    }
  });

  /**
   * Transcoded stream start
   */
  app.post( '/stream/transcode', async ( req, res ) => {
    const user = req.body.user;
    const app  = req.body.app;
    const name = req.body.name;

    if ( user ) {
      setTimeout( async () => {
        await streamauth.setTranscodeStatus( user, true );
        apiLogger.info(`[${app}] ${chalk.cyanBright.bold(user)} is now ${chalk.greenBright.bold('transcoded')}.`);
      }, updateDelay * 1000 );
    }

    res.send( `[${app}|${name}] is transcoding ${user}.` );
  });

  /**
   * Livestream disconnect
   */
  app.post( '/stream/end', async ( req, res ) => {
    const app  = req.body.app;
    const name = req.body.name;

    // Streamer has fully disconnected
    if ( app === 'live' ) {

      // Prevent live from firing if we go offline
      liveTimers.map( val => {
        if ( val.user === name )
          clearTimeout( val.timer );
        else
          return val;
      });

      // Set offline status
      await streamauth.setLiveStatus( name, false );
      apiLogger.info( `[${app}] ${chalk.cyanBright.bold(name)} is going ${chalk.redBright.bold('OFFLINE')}.` );

      res.send( `[${app}] ${name} is now OFFLINE` );
    }
  });


  /*********************************
   * Commands & Controls
   */

  /**
   * Start transcoding stream
   */
  app.post( '/stream/transcode/start', async ( req, res ) => {
    const user = req.body.user;

    // Attempt to get case sensitive username
    const streamer = serverData.getStreamer( user );

    // Failed to find user on server
    if ( !streamer ) {
      apiLogger.info( `${chalk.redBright( user )} failed to transcode... ( not found )` );
      return res.send( `Could not find ${user} in the livestream list.` );
    }

    // User found - Start transcoding
    apiLogger.info( `${chalk.cyanBright.bold( streamer )} will be transcoded... Starting transcoders...` );
    transcoder.startTranscoder( streamer );

    res.send( `${streamer} is now being transcoded.` );
  });

  /**
   * Stop transcoding stream
   */
  app.post( '/stream/transcode/stop', async ( req, res ) => {
    const user = req.body.user;

    // Attempt to get case sensitive username
    const streamer = serverData.getStreamer( user );

    // Failed to find user on server
    if ( !streamer ) {
      apiLogger.info( `${chalk.redBright( user)} failed to transcode... ( not found )` );
      return res.status( 200 ).send( `Could not find ${user} in the livestream list.` );
    }

    // User found - Stop transcoding
    apiLogger.info( `${chalk.cyanBright.bold(streamer)} will no longer be transcoded.` );

    // Revert streamer endpoint
    await streamauth.setTranscodeStatus( streamer, false );
    apiLogger.info( `${chalk.cyanBright.bold( streamer )}'s endpoint has been reverted` );

    // Stop transcode ffmpeg process
    transcoder.stopTranscoder( streamer );
    apiLogger.info( `${chalk.cyanBright.bold( streamer )}'s transcoding process has been stopped.` );

    res.status( 200 ).send(`${ streamer } is no longer being transcoded.`);
  });

  //-------------------------------

  /**
   * Start stream recorder
   */
  app.post( '/stream/record/start', async ( req, res ) => {
    const user = req.body.name;

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
  });

  /**
   * Stop stream recorder
   */
  app.post( '/stream/record/stop', async ( req, res ) => {
    const user = req.body.name;

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
  });

  //-------------------------------

  /**
   * Start restreaming process
   */
  app.post( '/api/restream/start', async ( req, res ) => {
    const user = req.body.user;
    const remoteServer = req.body.server;
    const remoteKey    = req.body.key;

    // Attempt to get case sensitive username
    const streamer = serverData.getStreamer( user );

    // Failed to find user on server
    if ( !streamer ) {
      apiLogger.info( `${chalk.redBright( user)} failed to restream... ( not found )` );
      return res.send( `Could not find ${user} in the livestream list.` );
    }

    // User found - Verify server & key
    if ( !remoteServer || !remoteKey ) {
      apiLogger.info( `${chalk.redBright( user)} missing restream server or key... ( not found )` );
      return res.send( `Could not find target restream server and / or key for ${user}.` );
    }

    // Start restreaming process
    apiLogger.info( `${chalk.cyanBright.bold( streamer )} will be restreamed... Starting restreamer...` );
    restreamer.startRestream( streamer, remoteServer, remoteKey );

    res.send( `${streamer} is now being restreamed` );
  });

  /**
   * Stop restreaming process
   */
  app.post( '/api/restream/start', async ( req, res ) => {
    const user = req.body.user;

    // Attempt to get case sensitive username
    const streamer = serverData.getStreamer( user );

    // Failed to find user on server
    if ( !streamer ) {
      apiLogger.info( `${chalk.redBright( user)} failed to restream... ( not found )` );
      return res.status( 200 ).send( `Could not find ${user} in the livestream list.` );
    }

    // Stop restreaming process
    apiLogger.info( `${chalk.cyanBright.bold( streamer )}'s restreaming process has been stopped.` );
    restreamer.stopRestream( streamer );

    res.send( `${streamer} is no longer being restreamed` );
  });

  //-------------------------------



  /*********************************
   * Stream Data
   */

  /**
   * Transcoded stream stats
   */
  app.get( '/stream/stats', async ( req, res ) => {
    const data = transcoder.transcoders.map( t => ({
      user: t.user,
      ffmpegProc: t.process.ffmpegProc,
      ffprobeData: t.process._ffprobeData,
      data: t.data
    }));

    res.status( 200 ).send( data );
  });

  /**
   * Transcoded stream stats for single user
   */
  app.get( '/stream/stats/:user', async ( req, res ) => {
    const data = transcoder.transcoders
      .filter( stats => stats.user.toLowerCase() === req.params.user.toLowerCase() )
      .map( stats => ({user: stats.user, ffmpegProc: stats.process.ffmpegProc, data: stats.data }) );

    res.send(
      transcoder.transcoders.filter( stats => {
        if ( stats.user.toLowerCase() === req.params.user.toLowerCase() )
          return { user: stats.user, data: stats.data }
      }));
  });


  /*********************************
   * Server Data
   */

  app.get( '/server/data', async ( req, res ) => {
    const data = serverData.getStreamerList();
    res.send( data );
  });

  app.get( '/server/data/:streamer', async ( req, res ) => {
    const streamer = req.params.streamer;
    const data = serverData.getStreamerData( streamer );

    // Verify we got data
    if ( !data ) return res.status( 404 ).send( 'Error: streamer not found' );

    // Update streamer's data
    serverData.updateStreamer( streamer );

    // Send results
    res.send( data );
  });


  /*********************************
   * Admin Commands
   */

  app.post( '/admin/drop', async ( req, res ) => {
    const streamer = req.body.streamer;
    const token    = req.body.token;

    if ( !streamer || !token ) return res.status( 422 ).send( 'Missing required parameters' );

    // Verify token
    try {
      const authorized = await streamauth.verifyToken( token, streamer );
      if ( !authorized ) {
        apiLogger.info( `Failed to validate access for ${streamer}` );
        return res.status( 403 ).send( 'Authentication Failed' );
      }
    } catch ( error ) {
      apiLogger.error( error.message );
      return res.status( 500 ).send( error );
    }

    // Get exact streamer endpoint
    const name = serverData.getStreamer( streamer );

    // Check if streamer was found
    if ( !name ) return res.status( 404 ).send( 'Streamer not found' );

    // Construct command
    const mode = 'drop';
    const type = 'publisher';
    const app  = 'live';
    const response = await rp( `${host}/${control}/${mode}/${type}?app=${app}&name=${name}` );

    // Log results
    apiLogger.info( `Drop ${name} result: ${response}` );

    // Return result
    await res.send( response );
  });

};
