// Created by xander on 12/16/2019

import logger from './Logger';
const log = logger('SDATA');

import {
  ffprobe,
  FfprobeFormat,
  FfprobeStream
} from 'fluent-ffmpeg';
import { streamauth } from '../webserver/api';
import * as chalk from 'chalk';


interface IResolution {
  width: number,
  height: number,
}

interface IVideoStats {
  duration: number,
  codec: string,
  bitrate: number,
  fps: string,
  keyframes: number,
  resolution: IResolution,
}

interface IAudioStats {
  codec: string,
  bitrate: number,
  samplerate: number,
  channels: number,
}

interface IStreamerData {
  name: string,
  timestamp: number,
  format: object,
  video: IVideoStats[],
  audio: IAudioStats[],
}

/**
 * @const {string} - The RTMP endpoint we will probe for data
 */
const rtmpServer: string = 'rtmp://nginx-server/live';

class ServerData {
  private streamers: Map<string, IStreamerData>;

  constructor() {
    this.streamers = new Map();
  }

  /**
   * Adds and tracks new streamer
   * @param {string} streamer
   * @return {void}
   */
  addStreamer ( streamer: string ): void {

    const streamerData: IStreamerData = {
      name: streamer,
      timestamp: Date.now(),
      format: {},
      video: [],
      audio: [],
    };

    this.streamers.set( streamer, streamerData );

    // Probe input stream
    this.probeStream( streamer );
  }

  /**
   * Uses ffprobe to get stream data
   * @param {string} streamer
   */
  private probeStream ( streamer: string ): void {
    const endpoint = `${rtmpServer}/${streamer}`;
    try {
      ffprobe(endpoint, (err, data) => {
        if ( err ) {
          log.error( err );
          return;
        }

        // log.info( JSON.stringify( data ) );

        // Log ffprobe results
        const videoData = data.streams.find(stream => stream.codec_type === 'video' );
        const audioData = data.streams.find(stream => stream.codec_type === 'audio' );

        if ( videoData ) {
          const vBitrate = (parseFloat(videoData.bit_rate) / 1024 / 1024).toFixed(2);
          log.info( `${videoData.codec_name} ${videoData.width}x${videoData.height} rFPS:${videoData.r_frame_rate} avgFPS:${videoData.avg_frame_rate} ${vBitrate}mb/s KeyFrame=${videoData.has_b_frames}` );
        } else {
          log.error( chalk.redBright('No video stream!') );
        }

        if ( audioData ) {
          const aBitrate = (parseFloat(audioData.bit_rate) / 1024).toFixed(2);
          log.info( `${audioData.codec_name} ${audioData.channels} channel ${aBitrate}kbs` );
        } else {
          log.error( chalk.redBright('No audio stream!') );
        }

        const streams: FfprobeStream[] = data.streams;

        const videoStream: FfprobeStream[] = streams.filter(stream => stream.codec_type === 'video');
        const audioStream: FfprobeStream[] = streams.filter(stream => stream.codec_type === 'audio');
        const format: FfprobeFormat = data.format;

        this.updateStreamerData( streamer, videoStream, audioStream, format );
      });
    } catch ( error ) {
      console.log(`Error occured probing streaming ${streamer}`);
      log.error( error );
    }
  }

  /**
   * Updates Stream Data from ffprobe data
   * @param {string} streamer
   * @param {FfprobeStream[]} videoStream
   * @param {FfprobeStream[]} audioStream
   * @param {FfprobeFormat} format
   * @return {void} - the result of this function has no use
   */
  private updateStreamerData ( streamer: string, videoStream: FfprobeStream[], audioStream: FfprobeStream[], format: FfprobeFormat ): void {
    // Ensure we haven't removed the streamer
    if ( !this.streamers.has( streamer ) ) return;

    // Get streamer's data
    let data = this.streamers.get( streamer );

    data.timestamp = Date.now();

    // Update video stream data
    data.video = [];
    if ( videoStream && videoStream.length > 0 ) {
      videoStream.forEach( vs => {
        data.video.push({
          duration: vs.start_time / 60,
          codec: vs.codec_name,
          bitrate: Number(vs.bit_rate),
          fps: vs.avg_frame_rate,
          keyframes: vs.has_b_frames,
          resolution: {
            width: vs.width,
            height: vs.height,
          }
        });
      });
    }

    // Update audio stream data
    data.audio = [];
    if ( audioStream && audioStream.length > 0 ) {
      audioStream.forEach( as => {
        data.audio.push({
          codec: as.codec_name,
          bitrate: Number(as.bit_rate),
          samplerate: as.sample_rate,
          channels: as.channels,
        });
      });
    }

    // Update format data
    if ( format ) {
      data.format = {
        filename: format.filename,
        start_time: format.start_time,
        probe_score: format.probe_score,
        tags: format.tags,
      }
    }

    // Update streamer's data in the map
    this.streamers.set( streamer, data );
  }

  /**
   * Remove livestreamer from map
   * @param {string} streamer
   * @return {void}
   */
  removeStreamer ( streamer: string ): void {
    this.streamers.delete( streamer );
  }

  /**
   * Gets an array of active streamers
   * @return {string[]}
   */
  getStreamerList (): string[] {
    return Array.from( this.streamers.keys() );
  }

  /**
   * Gets case sensitive streamer name from insensitive input
   * @param {string} streamer
   * @return {string|undefined} - returns undefined if failed to find streamer
   */
  getStreamer ( streamer: string ): string|undefined {
    return this.getStreamerList()
      .find( val => val.toLowerCase() === streamer.toLowerCase() );
  }

  /**
   * Gets streamer data from username
   * @param {string} streamer
   * @return {IStreamerData|null} - returns null if failed to find streamer
   */
  getStreamerData ( streamer: string ): IStreamerData|null {
    const user = this.getStreamer( streamer );
    if ( !user || !this.streamers.has( user ) ) return null;
    return this.streamers.get( user ); // Gets streamer data
  }

  /**
   * Requests a server update of streamer data
   * @param {string} streamer
   * @return {boolean} - returns false if failed to find streamer
   */
  updateStreamer ( streamer: string ): boolean {
    const user = this.getStreamer( streamer );
    if ( !user ) return false;
    this.probeStream( user ); // potential DDoS exploit
    return true;
  }

  /**
   * Cleans up data when shutting down server
   * @return {Promise<void>} - returns promise
   */
  async shutdown (): Promise<void> {
    const streamers = this.getStreamerList();
    if ( !streamers.length ) return Promise.resolve();
    await Promise.all(
      streamers.map( async streamer => {
        await streamauth.setLiveStatus( streamer, false );
      })
    );
  }
}

export const serverData = new ServerData();
