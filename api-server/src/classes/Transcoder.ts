const FfmpegCommand = require('fluent-ffmpeg');

interface ITranscoder {
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

class Transcoder {
  public transcoders: ITranscoder[];

  constructor () {
    this.transcoders = [];
  }

  startTranscoder ( user: string, enable144p: boolean, enable480p: boolean ) {
    // Check for existing transcoders
    const transcoder = this.transcoders.find( t => t.user.toLowerCase() === user.toLowerCase() );
    if ( transcoder && transcoder.process !== null ) {
      console.log( `${user} is already being transcoded.` );
      return;
    }

    console.log( `Start transcoding ${user}` );

    const inputStream  = `rtmp://nginx-server/live/${user}`;

    let outputStream;
    // there is nothing to do if 144 & 480 are disabled
    if ( !enable144p && !enable480p ) return false;
    if ( enable144p && !enable480p ) // 144p only
      outputStream = `rtmp://nginx-server/transcode_144/${user}`;
    if ( !enable144p && enable480p ) // 480p only
      outputStream = `rtmp://nginx-server/transcode_480/${user}`;
    if ( enable144p && enable480p ) // 144p && 480p
      outputStream = `rtmp://nginx-server/transcode/${user}`;

    const ffmpeg = FfmpegCommand( { stdoutLines: 3 } );

    ffmpeg.input( inputStream );
    ffmpeg.inputOptions([
      '-err_detect ignore_err',
      '-ignore_unknown',
      '-stats',
      '-fflags nobuffer+genpts+igndts',
    ]);

    if ( enable144p ) {
      ffmpeg.output( `${outputStream}_144` );
      ffmpeg.outputOptions( [
        '-f flv',
        '-map_metadata -1',
        '-metadata application=bitwavetv/transcoder',

        // Audio (copy)
        '-c:a copy',

        // Video (transcode)
        '-c:v libx264',
        '-preset:v superfast', // preset
        // '-b:v 250k', //bitrate
        // '-maxrate {bitrate}k', // bitrate
        // '-bufsize {bitrate}k', // bitrate
        // '-r {fps}', // fps
        '-g 60', // gop
        '-pix_fmt yuv420p',
        '-vsync 1',

        // custom
        '-crf 35',
        '-muxdelay 0',
        '-copyts',

        '-x264opts no-scenecut',
      ] )
        .size( '256x144' )
        .autopad( true, 'black' );
    }

    if ( enable480p ) {
      ffmpeg.output( `${outputStream}_480` );
      ffmpeg.outputOptions( [
        '-f flv',
        '-map_metadata -1',
        '-metadata application=bitwavetv/transcoder',

        // Audio (copy)
        '-c:a copy',

        // Video (transcode)
        '-c:v libx264',
        '-preset:v superfast', // preset
        // '-b:v 500k', //bitrate
        // '-maxrate {bitrate}k', // bitrate
        // '-bufsize {bitrate}k', // bitrate
        '-g 60', // gop
        '-pix_fmt yuv420p',
        '-vsync 1',

        // custom
        '-crf 35',
        '-muxdelay 0',
        '-copyts',

        '-x264opts no-scenecut',
      ] )
        .size( '854x480' )
        .autopad( true, 'black' );
    }

    ffmpeg.output( `${outputStream}_src?user=${user}` );
    ffmpeg.outputOptions([
      // Global
      '-f flv',
      '-map_metadata -1',
      '-metadata application=bitwavetv/transcoder',

      // Audio (copy)
      '-codec:a copy',

      // Video
      '-codec:v copy',
      '-vsync 0',
      '-copyts',
      '-start_at_zero',

      '-x264opts no-scenecut',
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
        console.log( `Stream transcoding ended.` );
        this.transcoders = this.transcoders.filter( t => t.user.toLowerCase() !== user.toLowerCase() );
        // retry
      })

      .on( 'error', ( error, stdout, stderr ) => {
        console.log( error );
        console.log( stdout );
        console.log( stderr );

        if ( error.message.includes( 'SIGKILL' ) ) {
          console.log( `Stream transcoding stopped!` );
        } else {
          console.log( `Stream transcoding error!` );
        }

        this.transcoders = this.transcoders.filter( t => t.user.toLowerCase() !== user.toLowerCase() );
      })

      .on( 'progress', progress => {
        this.transcoders.find( t => t.user.toLowerCase() === user.toLowerCase() ).data = {
          frames: progress.frames,
          fps: progress.currentFps,
          bitRate: progress.currentKbps,
          time: progress.timemark,
        };
      });

    ffmpeg.run();
  }

  stopTranscoder ( user ) {
    const transcoder = this.transcoders.find( t => t.user.toLowerCase() === user.toLowerCase() );
    if ( transcoder.process !== null ) {
      transcoder.process.kill( 'SIGKILL' );
      console.log( `Stopping transcoder!` );
    } else {
      console.log( `Transcoding process not running for ${user}.` )
    }
  }

}

export const transcoder = new Transcoder();
