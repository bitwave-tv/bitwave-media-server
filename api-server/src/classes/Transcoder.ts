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

  startTranscoder ( user ) {
    // Check for existing transcoders
    const transcoder = this.transcoders.find( t => t.user.toLowerCase() === user.toLowerCase() );
    if ( transcoder && transcoder.process !== null ) {
      console.log( `${user} is already being transcoded.` );
      return;
    }

    // let ffprobe;

    console.log( `Start transcoding ${user}` );

    const inputStream  = `rtmp://nginx-server/live/${user}`;
    const outputStream = `rtmp://nginx-server/transcode/${user}`;

    const ffmpeg = FfmpegCommand( { stdoutLines: 1 } );

    ffmpeg.input( inputStream );
    ffmpeg.inputOptions([
      // '-re',
      '-err_detect ignore_err',
      '-ignore_unknown',
      '-stats',
      '-fflags nobuffer+genpts',
    ]);

    ffmpeg.output( `${outputStream}_144` );
    ffmpeg.outputOptions([
      '-f flv',
      '-map_metadata -1',
      '-metadata application=bitwavetv/transcoder',

      // Audio (copy)
      '-c:a copy',
      // '-map 0:{audioid}', // audioid

      // Video (transcode)
      '-c:v libx264',
      '-preset:v veryfast', // preset
      '-b:v 250k', //bitrate
      // '-maxrate {bitrate}k', // bitrate
      // '-bufsize {bitrate}k', // bitrate
      // '-r {fps}', // fps
      '-g 60', // gop
      '-pix_fmt yuv420p',
      // '-map 0:{videoid}', // videoid
      '-vsync 1',

      // custom
      '-crf 35',
      '-muxdelay 0',
      '-copyts',

      // '-profile:v {profile}', // profile
      '-tune zerolatency', // tune
    ])
      .size( '256x144' )
      .autopad();

    ffmpeg.output( `${outputStream}_480` );
    ffmpeg.outputOptions([
      '-f flv',
      '-map_metadata -1',
      '-metadata application=bitwavetv/transcoder',

      // Audio (copy)
      '-c:a copy',
      // '-map 0:{audioid}', // audioid

      // Video (transcode)
      '-c:v libx264',
      '-preset:v veryfast', // preset
      '-b:v 500k', //bitrate
      // '-maxrate {bitrate}k', // bitrate
      // '-bufsize {bitrate}k', // bitrate
      // '-r {fps}', // fps
      '-g 60', // gop
      '-pix_fmt yuv420p',
      // '-map 0:{videoid}', // videoid
      '-vsync 1',

      // custom
      '-crf 35',
      '-muxdelay 0',
      '-copyts',

      // '-profile:v {profile}', // profile
      '-tune zerolatency', // tune
    ])
      .size( '854x480' )
      .autopad();

    ffmpeg.output( `${outputStream}_src?user=${user}` );
    ffmpeg.outputOptions([
      // Global
      '-f flv',
      '-map_metadata -1',
      '-metadata application=bitwavetv/transcoder',

      // Audio (copy)
      '-codec:a copy',
      // '-map 0:{audioid}', // audioid

      // Video
      '-codec:v copy',
      // '-map 0:{videoid}', //videoid
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
        console.log(`Stream transcoding ended.`);
        // this.transcoders.find( t => t.user.toLowerCase() === user.toLowerCase() ).process = null;
        this.transcoders = this.transcoders.filter( t => t.user.toLowerCase() !== user.toLowerCase() );
        // retry
      })

      .on( 'error', ( error, stdout, stderr ) => {
        console.log( `Stream transcoding error!` );
        console.log( error );
        console.log( stdout );
        console.log( stderr );
        // this.transcoders.find( t => t.user.toLowerCase() === user.toLowerCase() ).process = null;
        this.transcoders = this.transcoders.filter( t => t.user.toLowerCase() !== user.toLowerCase() );
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
