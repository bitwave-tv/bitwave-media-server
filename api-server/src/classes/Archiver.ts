// Created by xander on 12/30/2019

import * as admin from 'firebase-admin';
import { promises as fsp } from 'fs';
import * as chalk from 'chalk';
import * as FfmpegCommand from 'fluent-ffmpeg';
import { ffprobe } from 'fluent-ffmpeg';

import { stackpaths3 } from '../services/s3Storage';

interface IArchiveTransmuxed {
  file: string;
  type: 'flv'|'mp4';
  duration: number;
}

class ArchiveManager {
  constructor () {

  }

  async deleteArchive ( archiveId: string ) {
    try {
      // Create db reference to archive
      const archiveReference = admin.firestore()
        .collection( 'archives' )
        .doc( archiveId );

      const archiveDocument = await archiveReference.get();

      // Get data from archive
      const archive = archiveDocument.data();

      // Delete archive file
      await fsp.unlink( archive.file );
      console.log( `${archive._username}'s archive deleted: ${archiveId}` );

      // Flag archive as deleted
      await archiveReference
        .update( { deleted: true } );

      // Return results
      return {
        success: true,
        message: `archive deleted: ${archiveId}`,
      };

    } catch ( error ) {
      // An error occurred while attempting to delete an archive
      console.log( error );
      return {
        success: false,
        message: error.message,
      };

    }
  }

  async transmuxArchive ( file: string, channel: string ):Promise<IArchiveTransmuxed> {
    const transmuxAsync = ( file: string ):Promise<string> =>  new Promise( ( res, reject ) => {
      // Change flv to mp4
      const outFile = file.replace( /\.flv$/i, '.mp4' );

      const ffmpeg = FfmpegCommand();
      ffmpeg.input( file );
      ffmpeg.inputOptions([
        '-err_detect ignore_err',
        '-ignore_unknown',
        '-stats',
      ]);

      ffmpeg.output( outFile );
      ffmpeg.outputOptions([
        '-codec:a copy', // Audio (copy)
        '-codec:v copy', // Video (copy)
      ]);

      ffmpeg
        .on('start', command => {
          console.log( chalk.greenBright(`Starting archive transmux.`) );
        })

        .on( 'progress', progress => {
          console.log( progress );
        })

        .on('end', ( stdout, stderr ) => {
          console.log( chalk.greenBright(`Finished archive transmux.`) );
          return res ( outFile );
        })

        .on( 'error', ( error, stdout, stderr ) => {
          console.log( chalk.redBright(`Error during archive transmux.`) );

          console.log( error );
          console.log( stdout );
          console.log( stderr );

          return reject( error );
        });

      ffmpeg.run();
    });

    const probeTransmuxedFile = ( file: string ):Promise<object> => new Promise ( ( res, reject ) => {
      ffprobe( file, ( error, data ) => {
        if ( error ) return reject( error );

        // Video Data
        const videoData = data.streams.find(stream => stream.codec_type === 'video' );
        if ( videoData ) {
          // console.log( videoData );
        }

        // Audio Data
        const audioData = data.streams.find(stream => stream.codec_type === 'audio' );
        if ( audioData ) {
          // console.log( audioData );
        }

        return res({ video: videoData, audio: audioData });
      });
    });

    let transmuxFile = null;
    try {
      transmuxFile = await transmuxAsync( file );
    } catch ( error ) {
      console.log( `Archive transmux failed... Bailing early.` );
      console.log( error );
      return {
        file: file,
        type: 'flv',
        duration: 0,
      };
    }

    if ( !transmuxFile ) {
      console.log( `Archive transmux failed... Bailing early.` );
      return {
        file: file,
        type: 'flv',
        duration: 0,
      };
    }

    // Probe resulting mp4
    let transmuxData = null;
    try {
      transmuxData = await probeTransmuxedFile( transmuxFile );
    } catch ( error ) {
      console.log( `Archive transmux probe failed... Bailing early.` );
      console.log( error );
      return {
        file: file,
        type: 'flv',
        duration: 0,
      };
    }

    if ( !transmuxData ) {
      console.log( `Archive transmux probe failed... Bailing early.` );
      return {
        file: file,
        type: 'flv',
        duration: 0,
      };
    }

    console.log( `Delete source FLV file...` );

    // Delete source FLV file
    try {
      await fsp.unlink( file );
      console.log( chalk.greenBright( `${file} deleted.` ) );
    } catch ( error ) {
      console.log( chalk.redBright( `Archive source flv delete failed... This is bad..` ) );
      console.log( error );
    }



    // S3 Debug
    console.log( `Get S3 debug info...` );
    await stackpaths3.listBuckets();

    // S3 Upload
    console.log( `Upload to S3 bucket...` );
    const s3FileLocation = await stackpaths3.upload( transmuxFile );



    // Delete local mp4 file
    console.log( `Delete transmuxed mp4 file on local server...` );

    // Delete source mp4 file
    try {
      await fsp.unlink( transmuxFile );
      console.log( chalk.greenBright( `${transmuxFile} deleted.` ) );
    } catch ( error ) {
      console.log( chalk.redBright( `Archive source mp4 delete failed... This is bad..` ) );
      console.log( error );
    }


    return {
      file: s3FileLocation,
      type: 'mp4',
      duration: transmuxData.video.duration,
    };
  }

}

export const archiver = new ArchiveManager();
