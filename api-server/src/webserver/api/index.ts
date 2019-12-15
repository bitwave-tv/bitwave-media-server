// Created by xander on 10/30/2019

'use strict';

import * as chalk from 'chalk';
import * as rp from 'request-promise';

import logger from '../../classes/Logger';
const apiLogger = logger( 'APIv1' );

import { streamAuth } from '../../classes/StreamAuth';

const streamauth = streamAuth({
  hostServer : process.env['BMS_SERVER'] || 'stream.bitrave.tv',
  cdnServer  : process.env['BMS_CDN']    || 'cdn.stream.bitrave.tv',
});

import { Transcoder } from '../../classes/Transcoder';
const transcode = new Transcoder();

const updateDelay = 10;
const host        = 'http://nginx-server:8080';
const control     = 'control';

let liveTimers = [];

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

    if ( !app ) {
      res.sendStatus( 404 );
      return;
    }

    if ( app !== 'live' ) {
      res.status( 200 )
        .send( `${[app]} Auth not required` );
      return;
    }

    if ( !name || !key ) {
      res.sendStatus( 500 );
      return;
    }

    // Verify stream key
    const checkKey = await streamauth.checkStreamKey ( name, key );

    if ( checkKey ) {
      // If authorized, pre-fetch archive status
      const checkArchive = await streamauth.checkArchive( name );

      const timer = setTimeout( async () => {

        // Update live status
        await streamauth.setLiveStatus( name, true );

        // Check if we should archive stream
        if ( !checkArchive ) {
          apiLogger.info( `Archiving is disabled for ${chalk.cyanBright.bold(name)}` );
          return;
        }

        // Start stream archive
        let response;
        for ( let i = 0; i < 6; i++ ) {
          response = await rp( `${host}/${control}/record/start?app=live&name=${name}&rec=archive` );
          if ( !response ) {
            await new Promise( resolve => setTimeout( resolve, 1000 * 10 ) );
            apiLogger.info( `${chalk.redBright('Failed to start archive')}, attempting again in 10 seconds (${i}/6)` );
          } else {
            apiLogger.info( `Archiving ${chalk.cyanBright.bold(name)} to ${chalk.greenBright(response)}` );
            break;
          }
        }
      }, updateDelay * 1000 );

      liveTimers.push({
        user: name,
        timer: timer,
      });

      apiLogger.info( `[${app}] ${chalk.cyanBright.bold(name)} authorized.` );
      res.status( 200 )
        .send( `${name} authorized.` );
    } else {
      apiLogger.info( `[${app}] ${chalk.redBright.bold(name)} denied.` );
      res.status( 403 )
        .send( `${name} denied.` );
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
    res.status( 200 )
      .send( `[${app}|${name}] is transcoding ${user}.` );
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
      liveTimers.map( e => {
        if ( e.user === name )
          clearTimeout( e.timer );
        else
          return e;
      });

      // Set offline status
      await streamauth.setLiveStatus( name, false );
      apiLogger.info( `[${app}] ${chalk.cyanBright.bold(name)} is going ${chalk.redBright.bold('OFFLINE')}.` );
      res.status( 201 )
        .send( `[${app}] ${name} is now OFFLINE` );
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
    apiLogger.info( `${chalk.cyanBright.bold(user)} will be transcoded... Starting transcoders...` );
    transcode.startTranscoder( user );
    res.status( 200 )
      .send( `${user} is now being transcoded.` );
  });

  /**
   * Stop transcoding stream
   */
  app.post( '/stream/transcode/stop', async ( req, res ) => {
    const user = req.body.user;
    apiLogger.info( `${chalk.cyanBright.bold(user)} will no longer be transcoded.` );

    // Revert streamer endpoint
    await streamauth.setTranscodeStatus( user, false );
    apiLogger.info( `${chalk.cyanBright.bold(user)}'s endpoint has been reverted` );

    transcode.stopTranscoder( user );
    apiLogger.info( `${chalk.cyanBright.bold(user)}'s transcoding process has been stopped.` );

    res.status( 200 )
      .send(`${user} is no longer being transcoded.`);
  });

  /**
   * Start stream recorder
   */
  app.post( '/stream/record/start', async ( req, res ) => {
    const name = req.body.name;
    const response = await rp( `${host}/${control}/record/start?app=live&name=${name}&rec=archive` );

    if ( !response ) {
      apiLogger.info(`${chalk.redBright('Failed to start archive')}, please try again.`);
    } else {
      apiLogger.info(`Archiving ${chalk.cyanBright.bold(name)} to ${chalk.greenBright(response)}`);
      await streamauth.saveArchive( name, response );
    }

    res.status( !!response ? 200 : 502 ).send( !!response ? response : `${name} failed to start archive` );
  });

  /**
   * Stop stream recorder
   */
  app.post( '/stream/record/stop', async ( req, res ) => {
    const name = req.body.name;
    const response = await rp( `${host}/${control}/record/stop?app=live&name=${name}&rec=archive` );

    if ( !response ) {
      apiLogger.info(`${chalk.redBright('Failed to stop archive')}, please try again.` );
    } else {
      apiLogger.info(`Archive of ${chalk.cyanBright.bold(name)} saved to ${chalk.greenBright(response)}`);
    }

    res.status( !!response ? 200 : 502 ).send( !!response ? response : `${name} failed to stop archive` );
  });


  /*********************************
   * Stream Data
   */

  /**
   * Transcoded stream stats
   */
  app.get( '/stream/stats', async ( req, res ) => {
    const data = transcode.transcoders.map( t => ({
      user: t.user,
      ffmpegProc: t.process.ffmpegProc,
      ffprobeData: t.process._ffprobeData,
      data: t.data
    }));
    res.status( 200 )
      .send( data );
  });

  /**
   * Transcoded stream stats for single user
   */
  app.get( '/stream/stats/:user', async ( req, res ) => {
    const data = transcode.transcoders
      .filter( stats => stats.user.toLowerCase() === req.params.user.toLowerCase() )
      .map( stats => ({user: stats.user, ffmpegProc: stats.process.ffmpegProc, data: stats.data }) );

    res.status( 200 )
      .send( transcode.transcoders.filter( stats => {
        if ( stats.user.toLowerCase() === req.params.user.toLowerCase() ) {
          return { user: stats.user, data: stats.data }
        }
      }));
  });

};
