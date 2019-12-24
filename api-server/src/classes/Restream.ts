import * as FfmpegCommand from 'fluent-ffmpeg';
import * as chalk from 'chalk';

import logger from '../classes/Logger';
const restreamLogger = logger( 'RSTRM' );

interface IRestreamRelay {
  user: string;
  remoteService: string;
  process: any;
  data: IProgressData;
}

interface IProgressData {
  frames: number;
  bitRate: number;
  fps: number;
  time: number
}

class Restreamer {
  public restreams: IRestreamRelay[];

  constructor () {
    this.restreams = [];
  }

  startRestream ( user: string, restreamServeer: string, restreamKey: string ): boolean {
    // Check for existing restreamer
    const restreamer = this.restreams.find(t => t.user.toLowerCase() === user.toLowerCase() );
    if ( restreamer && restreamer.process !== null ) {
      restreamLogger.error( chalk.redBright( `${user} is already being streamed.` ) );
      return false;
    }

    restreamLogger.info( chalk.greenBright( `Start restream for ${user}` ) );

    const inputStream  = `rtmp://nginx-server/live/${user}`;
    const outputStream = `${restreamServeer}/${restreamKey}`;

    const ffmpeg = FfmpegCommand( inputStream, { stdoutLines: 1 } );
    // const ffmpeg = FfmpegCommand();

    ffmpeg.input( inputStream );
    ffmpeg.inputOptions([
      '-re',
      '-err_detect ignore_err',
      '-stats',
    ]);

    ffmpeg.output( `${outputStream}` );
    ffmpeg.outputOptions([
      // Global
      '-f flv',
      '-map_metadata -1',
      '-metadata application=bitwavetv/livestream',

      // Audio (copy)
      '-codec:a copy',
      // '-map 0:{audioid}', // audioid

      // Video
      '-codec:v copy',
      // '-map 0:{videoid}', //videoid

      // Extra
      '-vsync 0',
      '-copyts',
      '-start_at_zero'
    ]);

    ffmpeg
      .on( 'start', commandLine => {
        restreamLogger.info( chalk.yellowBright( `Starting restreamer.` ) );
        console.log( `Restreaming to: ${outputStream}` );
        console.log( commandLine );
        this.restreams.push({
          user: user,
          remoteService: restreamServeer,
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
        restreamLogger.info( chalk.redBright( `Restream ended.` ) );
        this.restreams.find(t => t.user.toLowerCase() === user.toLowerCase() ).process = null;
        // retry
      })

      .on( 'error', ( error, stdout, stderr ) => {
        restreamLogger.error( `Restreaming error!` );
        console.log( error );
        console.log( stdout );
        console.log( stderr );
        this.restreams.find(t => t.user.toLowerCase() === user.toLowerCase() ).process = null;
        // retry
      })

      .on( 'progress', progress => {
        this.restreams.find(t => t.user.toLowerCase() === user.toLowerCase() ).data = {
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

  stopRestream ( user: string ) {
    const transcoder = this.restreams.find(t => t.user.toLowerCase() === user.toLowerCase() );
    if ( transcoder.process !== null ) {
      transcoder.process.kill( 'SIGKILL' );
      restreamLogger.info( `Stopping restreamer!` );
      return true;
    } else {
      restreamLogger.error( `Restreamer process not running for ${user}.` );
      return false;
    }
  }

}

export const restreamer = new Restreamer();
