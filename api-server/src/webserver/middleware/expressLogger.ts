/**
 * @file express logger, that logs in the format of the BMS logger
 * @link https://github.com/bitwave-tv/bitwave-media-server
 * @copyright 2019 [bitwave.tv]
 * @license GPL-3.0
 */

'use strict';

import * as chalk from 'chalk';

import logger from '../../classes/Logger';
const webLogger = logger( 'EXPRS' );

export default ( req, res, next ) => {
  req._startTime = new Date();
  const log = () => {
    const code: number = res.statusCode;
    const url: string  = ( req.originalUrl || req.url );

    webLogger.debug( `${req.method} ${code} '${url}'` ); // req.ip

    if ( req.body ) webLogger.debug( `[${req.body.app}] ${chalk.cyanBright(req.body.name)}` );
  };

  res.on ( 'finish', log );
  res.on ( 'close',  log );

  next();
};
