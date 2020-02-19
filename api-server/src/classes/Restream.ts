import * as FfmpegCommand from 'fluent-ffmpeg';
import * as chalk from 'chalk';

import logger from '../classes/Logger';
import * as admin from 'firebase-admin';
const restreamLogger = logger( 'RSTRM' );

import { SocketClient } from './Socket';

type IRestreamerStatus = 'STARTING'|'ACTIVE'|'ERROR'|'STOPPING'|'STOPPED';

interface IRestreamRelay {
  user: string;
  id: string;
  state: IRestreamerStatus;
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

  async startRestream ( user: string, restreamServeer: string, restreamKey: string ): Promise<boolean> {
    // Check for existing restreamer
    const restreamer = this.restreams.find(t => t.user.toLowerCase() === user.toLowerCase() );
    if ( restreamer && restreamer.process !== null ) {
      restreamLogger.error( chalk.redBright( `${user} is already being restreamed.` ) );
      return false;
    }

    // Get restreamer ID from db
    const restreamerData = await this.getRestreamerData( user );

    if ( !restreamerData ) {
      restreamLogger.info( `${chalk.redBright( user)} missing restream data...` );
      return false;
    }

    const restreamerId = restreamerData.id;

    restreamLogger.info( chalk.greenBright( `Start restream for ${user}` ) );

    const inputStream  = `rtmp://nginx-server/live/${user}`;
    const outputStream = `${restreamServeer}/${restreamKey}`;

    const ffmpeg = FfmpegCommand( { stdoutLines: 3 } );

    ffmpeg.input( inputStream );
    ffmpeg.inputOptions([
      '-err_detect ignore_err',
      '-ignore_unknown',
      '-stats',
      '-fflags nobuffer+genpts+igndts',
    ]);

    ffmpeg.output( `${outputStream}` );
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

      '-x264opts no-scenecut',
    ]);

    ffmpeg
      .on( 'start', async commandLine => {
        restreamLogger.info( chalk.yellowBright( `Starting restreamer.` ) );
        console.log( `Restreaming to: ${restreamServeer}` );
        console.log( commandLine );
        this.restreams.push({
          user: user,
          id: restreamerId,
          state: 'STARTING',
          remoteService: restreamServeer,
          process: ffmpeg,
          data: {
            frames: 0,
            fps: 0,
            bitRate: 0,
            time: 0,
          },
        });
        await this.setRestreamerStatus( restreamerId, 'STARTING' );
        SocketClient.onRestreamStart( user );
      })

      .on( 'end', async () => {
        restreamLogger.info( chalk.redBright( `Restream ended.` ) );
        this.removeRestream( restreamerId );
        await this.setRestreamerStatus( restreamerId, 'STOPPED' );
        // retry
      })

      .on( 'error', async ( error, stdout, stderr ) => {
        console.log( error );
        console.log( stdout );
        console.log( stderr );

        if ( error.message.includes('SIGKILL') ) {
          restreamLogger.error( chalk.redBright( `Restreaming stopped!` ) );
          await this.setRestreamerStatus( restreamerId, 'STOPPED' );
        } else {
          restreamLogger.error( chalk.redBright( `Restreaming error!` ) );
          await this.setRestreamerStatus( restreamerId, 'ERROR' );
        }

        this.removeRestream( restreamerId );
        SocketClient.onRestreamEnd( user );
      })

      .on( 'data', async data => {
        console.log( `Restream Data:` );
        console.log( data );
      })

      .on( 'progress', async progress => {
        const restreamer = this.restreams.find(t => t.user.toLowerCase() === user.toLowerCase() );
        if ( restreamer.state !== 'ACTIVE' ) {
          await this.setRestreamerStatus( restreamerId, 'ACTIVE' );
          restreamer.state = 'ACTIVE';
        }
        restreamer.data = {
          frames: progress.frames,
          fps: progress.currentFps,
          bitRate: progress.currentKbps,
          time: progress.timemark,
        };
        SocketClient.onRestreamUpdate( user, progress );
      });

    ffmpeg.run();

    return true;
  }

  async stopRestream ( user: string ): Promise<boolean> {
    const restreamer = this.restreams.find(t => t.user.toLowerCase() === user.toLowerCase() );
    if ( restreamer.process !== null ) {
      restreamLogger.info( `Stopping restreamer!` );
      await this.setRestreamerStatus( restreamer.id, 'STOPPING' );
      restreamer.process.kill( 'SIGKILL' );
      return true;
    } else {
      restreamLogger.error( `Restreamer process not running for ${user}.` );
      return false;
    }
  }

  removeRestream ( restreamerId: string ) {
    this.restreams = this.restreams.filter( t => t.id !== restreamerId );
  }

  /**
   * Set restream status
   * @param {string} restreamer - Restreamer Id
   * @param {string} status - Restream status
   * @return {Promise<void>}
   */
  async setRestreamerStatus ( restreamer: string, status: IRestreamerStatus ): Promise<void> {
    const restreamerRef = admin.firestore()
      .collection( 'restreamers' )
      .doc( restreamer );

    const doc = await restreamerRef.get();

    if ( !doc.exists ) {
      restreamLogger.info( `${chalk.bgRedBright.black('ERROR:')} ${restreamer} is not a valid restreamer` );
      return;
    }

    const data = doc.data();

    await restreamerRef.update({
      state: status,
    });

    restreamLogger.info( `${chalk.cyanBright(data._username)}'s restreamer is ${ chalk.cyanBright.bold(status) }.` );
  };

  async getRestreamerData ( username: string ): Promise<FirebaseFirestore.QueryDocumentSnapshot|false> {
    const restreamerQuery = await admin.firestore()
      .collection( 'restreamers' )
      .where( '_username', '==', username.toLowerCase() )
      .get();

    if ( restreamerQuery.empty ) {
      console.log( `Failed to find a restreamer for ${username}` );
      return false;
    }

    return restreamerQuery.docs[0];
  };

}

export const restreamer = new Restreamer();
