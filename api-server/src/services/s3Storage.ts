// Created by xander on 3/11/2020

import * as fs from 'fs';
const fsp = fs.promises;

// import * as zlib from 'zlib';
import * as path from 'path';

import * as AWS from 'aws-sdk';
import S3 = require('aws-sdk/clients/s3');
import { AWSError } from 'aws-sdk';
import { ListBucketsOutput } from 'aws-sdk/clients/s3';



// const stackpathEndpoint = new AWS.Endpoint( 's3.us-west.stackpathstorage.com' );

/*const logAction = ( err, data ) => {
  if ( err ) console.log( err, err.stack );
  else console.log( data );
};*/

class StackpathS3 {
  private s3: S3;
  private readonly bucket: string;

  constructor( config ) {
    this.s3 = new AWS.S3( config );
    this.bucket = config.params.Bucket;
  }

  // Logs a list of all S3 buckets
  async listBuckets (): Promise<void> {
    return new Promise<void>(resolve =>
      this.s3.listBuckets( ( err: AWSError, data: ListBucketsOutput ) => {
        if ( err ) {
          console.log( err.message );
        } else {
          data[ 'Buckets' ].forEach( space => console.log( 'Bucket:', space[ 'Name' ] ) );
        }
        resolve();
      })
    );
  }


  // Upload file (single shot)
  async putObject ( fileLocation: string )  {
    const filename = path.basename( fileLocation );

    const data = fs.createReadStream( fileLocation )
      // .pipe( zlib.createGzip() );

    // Upload a file
    const params: S3.PutObjectRequest = {
      Bucket: this.bucket,
      Key: filename,
      Body: data,
      ContentType: 'video/mp4',
      ACL: 'public-read',
    };

    try {
      const result = await this.s3
        .putObject( params )
        .promise();

      console.log( result );
    } catch ( error ) {
      console.error(  error.message );
    }

  }


  // Upload file (multipart)
  async upload ( fileLocation: string, service: string )  {
    const filename = `${service}-replay/${path.basename( fileLocation )}`;
    const data = fs.createReadStream( fileLocation );

    // Upload a file
    const params: S3.PutObjectRequest = {
      Bucket: this.bucket,
      Key: filename,
      Body: data,
      ContentType: 'video/mp4',
      ACL: 'public-read',
    };

    try {
      const result = await this.s3
        .upload( params )
        .promise();

      // console.log( result );
      console.log( `Video location: ${result.Location}` );
      return {
        key: result.Key,
        location: result.Location,
        etag: result.ETag,
      }
    } catch ( error ) {
      console.error(  error.message );
    }

  }


  // Upload thumbnail image (multipart)
  async uploadImage ( fileLocation: string, service: string )  {
    const filename = `${service}-replay/thumbnails/${path.basename( fileLocation )}`;
    const data = fs.createReadStream( fileLocation );

    // Upload a file
    const params: S3.PutObjectRequest = {
      Bucket: this.bucket,
      Key: filename,
      Body: data,
      ContentType: 'image/png',
      ACL: 'public-read',
    };

    try {
      const result = await this.s3
        .upload( params )
        .promise();

      // console.log( result );
      console.log( `Image location: ${result.Location}` );
      return {
        key: result.Key,
        location: result.Location,
        etag: result.ETag,
      }
    } catch ( error ) {
      console.error(  `Upload failed: ${error.message}` );
    }

  }


  // Delete file
  async deleteFile ( fileLocation: string ) {
    // Delete a file
    const params = {
      Bucket: this.bucket,
      Key: fileLocation,
    };

    try {
      const result = this.s3
        .deleteObject( params )
        .promise();

      console.log( result );
    } catch ( error ) {
      console.error(  error.message );
    }
  }

}



interface S3Config {
  params: {
    bucket: string,
  },
  version: string,
  region: string,
  endpoint: string,
  accessKeyId: string,
  secretAccessKey: string,
}


// Get S3 config file
const stackpathConfig: S3Config = require('../../creds/stackpath-config.json');

export const stackpaths3 = new StackpathS3( stackpathConfig );
