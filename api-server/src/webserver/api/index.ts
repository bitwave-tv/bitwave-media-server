// Created by xander on 10/30/2019

'use strict';

import * as chalk from 'chalk';
import * as rp from 'request-promise';

import logger from '../../classes/Logger';
const webLogger = logger( 'API' );

import { streamAuth } from '../../classes/StreamAuth';

const streamauth = streamAuth({
  hostServer : process.env['BMS_SERVER_URL'] || 'stream.bitrave.tv',
  cdnServer  : process.env['BMS_CDN_URL']    || 'cdn.stream.bitrave.tv',
});

import { Transcoder } from '../../classes/Transcoder';
const transcode = new Transcoder();

const updateDelay = 10;
const host        = 'http://nginx-server:8080';
const control     = 'control';

let liveTimers = [];

export default app => {
  // Authorize livestream
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
        .send( `Auth not required` );
      return;
    }

    if ( !name || !key ) {
      res.sendStatus( 500 );
      return;
    }

    const checkKey = await streamauth.checkStreamKey ( name, key );

    if ( checkKey ) {
      const timer = setTimeout( async () => {
        await streamauth.setLiveStatus( name, true, false );
        // Start stream archive
        let response;
        for ( let i = 0; i < 3; i++ ) {
          response = await rp( `${host}/${control}/record/start?app=live&name=${name}&rec=archive` );
          if ( !response ) {
            await new Promise( resolve => setTimeout( resolve, 1000 * 10 ) );
            console.log( `${chalk.redBright('Failed to start archive')}, attempting again in 10 seconds (${i}/3)` );
          } else {
            console.log( `Archiving ${chalk.cyanBright.bold(name)} to ${chalk.greenBright(response)}` );
            break;
          }
        }
      }, updateDelay * 1000 );

      liveTimers.push({
        user: name,
        timer: timer,
      });

      webLogger.info( `[${app}] ${chalk.cyanBright.bold(name)} authorized.` );
      res.status( 200 )
        .send( `${name} authorized.` );
    } else {
      webLogger.info( `[${app}] ${chalk.redBright.bold(name)} denied.` );
      res.status( 403 )
        .send( `${name} denied.` );
    }
  });

  // Transcoded stream start
  app.post( '/stream/transcode', async ( req, res ) => {
    const user = req.body.user;
    const app  = req.body.app;
    const name = req.body.name;

    if ( user ) {
      setTimeout( async () => {
        await streamauth.setLiveStatus( user, true, true );
        console.log(`[${app}] ${chalk.cyanBright.bold(user)} is now ${chalk.greenBright.bold('transcoded')}.`);
      }, updateDelay * 1000 );
    }
    res.status( 200 )
      .send( `[${app}|${name}] is transcoding ${user}.` );
  });

  // Livestream disconnect
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
      console.log( `[${app}] ${chalk.cyanBright.bold(name)} stopped streaming.` );
      res.status( 201 )
        .send( `[${app}] ${name} is now OFFLINE` );
    }
  });

  // Start transcoding stream
  app.post( '/stream/start-transcode', async ( req, res ) => {
    const user = req.body.user;
    console.log( `${chalk.cyanBright.bold(user)} will be transcoded... Starting transcoders...` );
    transcode.startTranscoder( user );
    res.status( 200 )
      .send( `${chalk.cyanBright.bold(user)} is now being transcoded.` );
  });

  // Stop transcoding stream
  app.post( '/stream/stop-transcode', async ( req, res ) => {
    const user = req.body.user;
    console.log( `${chalk.cyanBright.bold(user)} will no longer be transcoded.` );

    // Revert streamer endpoint
    await streamauth.setLiveStatus( user, true, false );
    console.log( `${chalk.cyanBright.bold(user)}'s endpoint has been reverted` );

    transcode.stopTranscoder( user );
    console.log( `${chalk.cyanBright.bold(user)}'s transcoding process has been stopped.` );

    res.status( 200 )
      .send(`${user} is no longer being transcoded.`);
  });

  // Transcoded stream stats
  app.get( '/stream/stats', async ( req, res ) => {
    res.status( 200 )
      .send( transcode.transcoders.map( t => ({ user: t.user, data: t.data }) ) );
  });

  // TODO: create API endpoint /stream/stats/{streamer}

};
