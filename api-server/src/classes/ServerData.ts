// Created by xander on 12/16/2019

import logger from './Logger';
const log = logger('SDATA');

import { ffprobe } from 'fluent-ffmpeg';

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

class ServerData {
  private streamers: Map<string, IStreamerData>;

  constructor() {
    this.streamers = new Map();
  }

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

  private probeStream ( streamer: string ): void {
    const endpoint = `rtmp://nginx-server/live/${streamer}`;
    try {
      ffprobe(endpoint, (err, data) => {
        if ( err ) {
          log.error( err );
          return;
        }

        log.info( JSON.stringify( data ) );

        const streams = data.streams;

        const videoStream = streams.filter(stream => stream.codec_type === 'video');
        const audioStream = streams.filter(stream => stream.codec_type === 'audio');
        const format      = data.format;

        this.updateStreamerData( streamer, videoStream, audioStream, format );
      });
    } catch ( error ) {
      log.error( error );
    }
  }

  private updateStreamerData ( streamer: string, videoStream: any[], audioStream: any[], format: any ): void {
    let data = this.streamers.get( streamer );

    data.video = [];
    data.audio = [];

    if ( videoStream ) {
      videoStream.forEach( vs => {
        data.video.push({
          duration: vs.start_time / 60,
          codec: vs.codec_name,
          bitrate: vs.bit_rate,
          fps: vs.avg_frame_rate,
          keyframes: vs.has_b_frames,
          resolution: {
            width: vs.width,
            height: vs.height,
          }
        });
      });

    }

    if ( audioStream ) {
      audioStream.forEach( as => {
        data.audio.push({
          codec: as.codec_name,
          bitrate: as.bit_rate,
          samplerate: as.sample_rate,
          channels: as.channels,
        });
      });

      if ( format ) {
        data.format = {
          filename: format.filename,
          start_time: format.start_time,
          probe_score: format.probe_score,
          tags: format.tags,
        }
      }
    }

    this.streamers.set( streamer, data );
  }

  removeStreamer ( streamer: string ): void {
    this.streamers.delete( streamer );
  }

  updateStreamer ( streamer: string ) {
    const list = this.getStreamerList();
    const result = list.find( val => val.toLowerCase() === streamer.toLowerCase() );
    if ( !result ) return false;
    this.probeStream( result );
  }

  getStreamerList (): string[] {
    return Array.from( this.streamers.keys() );
  }

  getStreamerData ( streamer: string ): IStreamerData|null {
    if ( !this.streamers.has( streamer ) ) return null;
    return this.streamers.get( streamer );
  }
}

export const serverData = new ServerData();
