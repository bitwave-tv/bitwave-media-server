import * as FfmpegCommand from 'fluent-ffmpeg';
import * as chalk from 'chalk';

import logger from '../classes/Logger';
const relayLogger = logger( 'RELAY' );

import { SocketClient } from './Socket';
import { ffprobe } from 'fluent-ffmpeg';

interface IStreamRelay {
  user: string;
  process: any;
  data: IProgressData;
}

interface IProgressData {
  frames: number;
  bitRate: number;
  fps: number;
  time: number;
}

class StreamRelay {
  public transcoders: IStreamRelay[];

  constructor () {
    this.transcoders = [];
  }

  async startRelay ( user: string ): Promise<boolean> {
    // Check for existing HLS relay
    const transcoder = this.transcoders.find( t => t.user.toLowerCase() === user.toLowerCase() );
    if ( transcoder && transcoder.process !== null ) {
      relayLogger.error( chalk.redBright( `${user} is already being streamed.` ) );
      return false;
    }

    relayLogger.info( chalk.greenBright( `Start HLS stream for ${user}` ) );

    const inputStream  = `rtmp://nginx-server/live/${user}`;
    const outputStream = `rtmp://nginx-server/hls/${user}`;

    // Waste some time probing the input for up to 15 seconds
    try {
      const probeResult = await this.probeInputAsync( inputStream );
      relayLogger.info( `[${user}] Probe returned: ${probeResult}` );
    } catch ( error ) {
      relayLogger.error( error );
      return false;
    }


    // screenshot generator
    const generateThumbnail = () => {
      const screenshotFFmpeg = FfmpegCommand({ logger: relayLogger });

      screenshotFFmpeg.renice( 5 )

      // screenshotFFmpeg.input( `/tmp/preview/${user}.flv` );
      screenshotFFmpeg.input( inputStream );
      screenshotFFmpeg.inputOptions([
        '-err_detect ignore_err',
        '-ignore_unknown',
        '-stats',
        '-fflags nobuffer+genpts+igndts',
      ]);

      screenshotFFmpeg.output( `/tmp/preview/${user}.jpg` );
      screenshotFFmpeg.outputOptions([
        '-frames:v 1', // frames
        '-q:v 25', // image quality
        '-an', // no audio
        '-y', // overwrite file
      ]);

      screenshotFFmpeg
        .on( 'start', commandLine => {
          relayLogger.info( chalk.yellowBright( `Starting preview thumbnail generator` ) );
        })

        .on( 'end', () => {
          relayLogger.info( chalk.green( `Created preview thumbnail for ${user}.` ) );
        })

        .on( 'error', ( error, stdout, stderr ) => {
          console.log( error );
          console.log( stdout );
          console.log( stderr );

          if ( error.message.includes('SIGKILL') ) {
            relayLogger.error( `${user}: Stream thumbnail stopped!` );
          } else {
            relayLogger.error( chalk.redBright( `${user}: Stream thumbnail error!` ) );
          }
        })

        .on( 'progress', progress => {
          // progress
        });
      screenshotFFmpeg.run();
    };
    const thumbnailTimer = setInterval( () => generateThumbnail(), 60 * 1000 );


    // ffmpeg relay
    const ffmpeg = FfmpegCommand( { logger: relayLogger } ); // { stdoutLines: 3 }

    ffmpeg.input( inputStream );
    ffmpeg.inputOptions([
      '-err_detect ignore_err',
      '-ignore_unknown',
      '-stats',
      '-fflags nobuffer+genpts+igndts',
    ]);

    ffmpeg.output( `${outputStream}?user=${user}` );
    ffmpeg.outputOptions([
      // Global
      '-f flv',
      '-map_metadata -1',
      '-metadata application=bitwavetv/livestream',

      '-codec:a copy', // Audio (copy)
      '-codec:v copy', // Video (copy)

      // Extra
      '-vsync 0',
      '-copyts',
      '-start_at_zero',
      '-movflags faststart',

      '-x264opts no-scenecut',
    ]);

    ffmpeg
      .on( 'start', commandLine => {
        relayLogger.info( chalk.yellowBright( `Starting stream relay.` ) );
        relayLogger.info( commandLine );

        this.transcoders.push({
          user: user,
          process: ffmpeg,
          data: {
            frames: 0,
            fps: 0,
            bitRate: 0,
            time: 0,
          },
        });
        SocketClient.onConnect( user );
      })

      .on( 'end', () => {
        relayLogger.info( chalk.redBright( `Livestream ended.` ) );
        this.transcoders = this.transcoders.filter( t => t.user.toLowerCase() !== user.toLowerCase() );
        SocketClient.onDisconnect( user );
        clearInterval( thumbnailTimer );
      })

      .on( 'error', ( error, stdout, stderr ) => {
        console.log( error );
        console.log( stdout );
        console.log( stderr );

        if ( error.message.includes('SIGKILL') ) {
          relayLogger.error( `${user}: Stream relay stopped!` );
        } else {
          relayLogger.error( chalk.redBright( `${user}: Stream relay error!` ) );
        }

        this.transcoders = this.transcoders.filter( t => t.user.toLowerCase() !== user.toLowerCase() );
        SocketClient.onDisconnect( user );
        clearInterval( thumbnailTimer );
      })

      .on( 'progress', progress => {
        const transcoder = this.transcoders.find( t => t.user.toLowerCase() === user.toLowerCase() );
        if ( !transcoder ) return;
        transcoder.data = {
          frames: progress.frames,
          fps: progress.currentFps,
          bitRate: progress.currentKbps,
          time: progress.timemark,
        };
        SocketClient.onUpdate( user, progress );
      });

    ffmpeg.run();
    return true;
  }

  async probeInputAsync ( endpoint: string ):Promise<true> {
    return new Promise( ( res, reject ) => {
      const TIMEOUT = 15;

      const timeout = setTimeout( () => {
        relayLogger.error( chalk.redBright( `Timed out while probing: '${endpoint}'` ) );
        reject('timeout');
      }, TIMEOUT * 1000 * 2 );

      relayLogger.info(`Attempting to probe '${endpoint}'`);

      try {
        ffprobe( endpoint, ( error, data ) => {
          clearTimeout( timeout ); // Cancel timer

          if ( error ) return reject( error );

          const videoData = data.streams.find(stream => stream.codec_type === 'video' );
          if ( videoData ) {
            const vBitrate = parseFloat(videoData.bit_rate) / 1024 / 1024;
            // Prevent exceptionally high bitrates
            if ( vBitrate > 6 ) {
              clearTimeout( timeout ); // Cancel timer
              relayLogger.info( `${videoData.width}x${videoData.height} rFPS:${videoData.r_frame_rate} avgFPS:${videoData.avg_frame_rate} ${vBitrate.toFixed(2)}mb/s b_frames=${videoData.has_b_frames}` );
              console.log( chalk.redBright( `Bitrate is too high! '${endpoint}': ${error}`) );
              // Reject early to prevent abuse
              return reject( 'Bitrate is too high!' );
            }
            relayLogger.info( `${videoData.codec_name} ${videoData.width}x${videoData.height} rFPS:${videoData.r_frame_rate} avgFPS:${videoData.avg_frame_rate} ${vBitrate.toFixed(2)}mb/s b_frames=${videoData.has_b_frames}` );
          } else {
            relayLogger.error( chalk.redBright('No video stream!') );
          }

          const audioData = data.streams.find(stream => stream.codec_type === 'audio' );
          if ( audioData ) {
            const aBitrate = (parseFloat(audioData.bit_rate) / 1024).toFixed(2);
            relayLogger.info( `${audioData.codec_name} ${audioData.channels} channel ${aBitrate}kbs` );
          } else {
            relayLogger.error( chalk.redBright('No audio stream!') );
          }

          return res ( true );
        });
      } catch ( error ) {
        clearTimeout( timeout ); // Cancel timer
        console.log(`Error occured probing '${endpoint}': ${error.message}`);
        relayLogger.error( error );
        return reject( error );
      }
    });

  }

  stopRelay ( user: string ): boolean {
    const transcoder = this.transcoders.find( t => t.user.toLowerCase() === user.toLowerCase() );
    if ( transcoder.process !== null ) {
      transcoder.process.kill( 'SIGKILL' );
      relayLogger.info( `Stopping HLS stream!` );
      return true;
    } else {
      relayLogger.error( `HLS Streaming process not running for ${user}.` );
      return false;
    }
  }

}

export const hlsRelay = new StreamRelay();
