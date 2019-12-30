import * as FfmpegCommand from 'fluent-ffmpeg';
import * as chalk from 'chalk';

import logger from '../classes/Logger';
const relayLogger = logger( 'RELAY' );

interface IStreamRelay {
  user: string;
  process: any;
  data: IProgressData;
}

interface IProgressData {
  frames: number;
  bitRate: number;
  fps: number;
  time: number
}

class StreamRelay {
  public transcoders: IStreamRelay[];

  constructor () {
    this.transcoders = [];
  }

  startRelay ( user: string ): boolean {
    // Check for existing HLS relay
    const transcoder = this.transcoders.find( t => t.user.toLowerCase() === user.toLowerCase() );
    if ( transcoder && transcoder.process !== null ) {
      relayLogger.error( chalk.redBright( `${user} is already being streamed.` ) );
      return false;
    }

    relayLogger.info( chalk.greenBright( `Start HLS stream for ${user}` ) );

    const inputStream  = `rtmp://nginx-server/live/${user}`;
    const outputStream = `rtmp://nginx-server/hls/${user}`;

    // const ffmpeg = FfmpegCommand( inputStream, { stdoutLines: 1 } );
    const ffmpeg = FfmpegCommand( { stdoutLines: 1 } );

    ffmpeg.input( inputStream );
    ffmpeg.inputOptions([
      '-re',
      '-err_detect ignore_err',
      '-stats',
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
      '-start_at_zero'
    ]);

    ffmpeg
      .on( 'start', commandLine => {
        relayLogger.info( chalk.yellowBright( `Starting stream relay.` ) );
        console.log( commandLine );
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
      })

      .on( 'end', () => {
        relayLogger.info( chalk.redBright( `Livestream ended.` ) );
        this.transcoders.find( t => t.user.toLowerCase() === user.toLowerCase() ).process = null;
        // retry
      })

      .on( 'error', ( error, stdout, stderr ) => {
        relayLogger.error( `Stream relay error!` );
        console.log( error );
        console.log( stdout );
        console.log( stderr );
        this.transcoders.find( t => t.user.toLowerCase() === user.toLowerCase() ).process = null;
        // retry
      })

      .on( 'progress', progress => {
        this.transcoders.find( t => t.user.toLowerCase() === user.toLowerCase() ).data = {
          frames: progress.frames,
          fps: progress.currentFps,
          bitRate: progress.currentKbps,
          time: progress.timemark,
        };
        // console.log(`${progress.frames} FPS:${progress.currentFps} ${(progress.currentKbps / 1000).toFixed(1)}Mbps - ${progress.timemark}`);
      });

    ffmpeg.run();

    return true;
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
