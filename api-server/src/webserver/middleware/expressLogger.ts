/**
 * @file express logger, that logs in the format of the BMS logger
 * @link https://github.com/bitwave-tv/bitwave-media-server
 * @copyright 2019 [bitwave.tv]
 * @license GPL-3.0
 */

'use strict';

import logger from '../../classes/Logger';
const webLogger = logger( 'API' );

export default ( req, res, next ) => {
  req._startTime = new Date();
  const log = () => {
    const code: number = res.statusCode;
    const url: string  = ( req.originalUrl || req.url );

    webLogger.debug( `${req.method} "${url}" ${code} ${req.ip}` );

    if ( req.body ) webLogger.debug( `${req.body.app}|${req.body.name}` );
  };

  res.on ( 'finish', log );
  res.on ( 'close', log );
  next();
};
