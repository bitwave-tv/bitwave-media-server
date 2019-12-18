import * as FfmpegCommand from 'fluent-ffmpeg';

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

  startRelay ( user: string ) {
    // Check for existing transcoders
    const transcoder = this.transcoders.find( t => t.user.toLowerCase() === user.toLowerCase() );
    if ( transcoder && transcoder.process !== null ) {
      relayLogger.error( `${user} is already being streamed.` );
      return;
    }

    relayLogger.info( `Start streaming ${user}` );

    const inputStream  = `rtmp://nginx-server/live/${user}`;
    const outputStream = `rtmp://nginx-server/hls/${user}`;

    const ffmpeg = FfmpegCommand( inputStream, { stdoutLines: 1 } );
    // const ffmpeg = FfmpegCommand();

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
        console.log( `Starting transcode stream.` );
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
        console.log(`Livestream ended.`);
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
  }

  stopRelay ( user: string ) {
    const transcoder = this.transcoders.find( t => t.user.toLowerCase() === user.toLowerCase() );
    if ( transcoder.process !== null ) {
      transcoder.process.kill( 'SIGKILL' );
      relayLogger.info( `Stopping transcoder!` );
    } else {
      relayLogger.error( `Transcoding process not running for ${user}.` )
    }
  }

}

export const hlsRelay = new StreamRelay();
