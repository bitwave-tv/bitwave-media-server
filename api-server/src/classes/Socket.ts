
import * as socketio from 'socket.io-client';

import logger from '../classes/Logger';
const socketLogger = logger('SCKET');

class APISocket {
  private socket: SocketIOClient.Socket;
  private readonly server: string;
  private connected: boolean;

  constructor () {
    const host = 'https://api.bitwave.tv';

    this.server = process.env['BMS_SERVER'] || 'stream.bitrave.tv';
    this.connected = false;

    this.socket = socketio( host, { transports: ['websocket'] } );

    this.socket.on( 'connect',     () => this.onServerConnect() );
    this.socket.on( 'disconnect',  () => this.onServerDisconnect() );
  }

  onServerConnect () {
    this.connected = true;
    socketLogger.info( `Ingestion server connected to API server socket.` );
  }

  onServerDisconnect () {
    this.connected = false;
  }

  onConnect ( streamer ) {
    if ( !this.connected ) return;

    const data = {
      streamer: streamer,
      server: this.server,
    };

    this.socket.emit( 'ingestion.streamer.connect', data );
    socketLogger.info( `${streamer} connecting to API server socket` );
  }

  onUpdate ( streamer, stats ) {
    if ( !this.connected ) return;

    const data = {
      streamer: streamer,
      data: stats,
    };

    this.socket.emit( 'ingestion.streamer.update', data );
  }

  onRestreamStart ( streamer ) {
    if ( !this.connected ) return;

    const data = {
      streamer: streamer,
      server: this.server,
    };

    this.socket.emit( 'ingestion.restreamer.connect', data );
    socketLogger.info( `${streamer} restreamer has connected` );
  }

  onRestreamUpdate ( streamer, stats ) {
    if ( !this.connected ) return;

    const data = {
      streamer: streamer,
      data: stats,
    };

    this.socket.emit( 'ingestion.restreamer.update', data );
  }

  onRestreamEnd ( streamer ) {
    if ( !this.connected ) return;

    const data = {
      streamer: streamer,
      server: this.server,
    };

    this.socket.emit( 'ingestion.restreamer.disconnect', data );
    socketLogger.info( `${streamer} restreamer has disconnected` );
  }

  onDisconnect( streamer ) {
    if ( !this.connected ) return;

    const data = {
      streamer: streamer,
      server: this.server,
    };

    this.socket.emit( 'ingestion.streamer.disconnect', data );
    socketLogger.info( `${streamer} disconnecting API server socket` );
  }

}

export const SocketClient = new APISocket();
