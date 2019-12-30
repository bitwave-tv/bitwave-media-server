// Created by xander on 12/30/2019

import * as admin from 'firebase-admin';
import { promises as fsp } from 'fs';

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

}

export const archiver = new ArchiveManager();
