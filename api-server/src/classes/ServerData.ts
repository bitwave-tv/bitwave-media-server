// Created by xander on 12/16/2019

import logger from './Logger';
const log = logger('SDATA');

import { ffprobe } from 'fluent-ffmpeg';

interface IResolution {
  width: number,
  height: number,
}

interface IVideoStats {
  codec: string,
  bitrate: string,
  fps: string,
  keyframes: number,
  resolution: IResolution,
}

interface IAudioStats {
  codec: string,
  bitrate: string,
}

interface IStreamerData {
  name: string,
  timestamp: number,
  video: IVideoStats|null,
  audio: IAudioStats|null,
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
      video: null,
      audio: null,
    };

    this.streamers.set( streamer, streamerData );

    // Probe input stream
    const endpoint = `rtmp://localhost/live/${streamer}`;
    try {
      ffprobe(endpoint, (err, data) => {
        const streams = data.streams;

        const videoStream = streams.filter(stream => stream.codec_type === 'video');
        const audioStream = streams.filter(stream => stream.codec_type === 'audio');

        this.updateStreamerData(streamer, videoStream, audioStream);
      });
    } catch ( error ) {
      log.error( error.message );
    }
  }

  private updateStreamerData ( streamer: string, videoStream: any, audioStream: any ): void {
    let data = this.streamers.get( streamer );

    if ( videoStream ) {
      data.video = {
        codec: videoStream.codec_name,
        bitrate: videoStream.bit_rate,
        fps: videoStream.avg_frame_rate,
        keyframes: videoStream.has_b_frames,
        resolution: {
          width: videoStream.width,
          height: videoStream.height,
        }
      }
    }

    if ( audioStream ) {
      data.audio = {
        codec: audioStream.codec_name,
        bitrate: audioStream.bit_rate,
      }
    }

    this.streamers.set( streamer, data );
  }

  removeStreamer ( streamer: string ): void {
    this.streamers.delete( streamer );
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
