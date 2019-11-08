/**
 * @file express logger, that logs in the format of the BMS logger
 * @link https://github.com/bitwave-tv/bitwave-media-server
 * @copyright 2019 [bitwave.tv]
 * @license GPL-3.0
 */

'use strict';

import logger from '../../classes/Logger';
const webLogger = logger('webserver');

export default (req, res, next) => {
    req._startTime = new Date();
    const log = () => {
        const code: number = res.statusCode;
        const len: number = parseInt(res.getHeader('Content-Length'), 10);
        const duration: number = new Date().getTime() - req._startTime.getTime();
        const url: string = (req.originalUrl || req.url);

        // ``${req.method} "${url}" ${code} ${duration}ms ${req.ip} ${len || '-'}`
        webLogger.debug(`${req.method} "${url}" ${code} ${req.ip}`);
        if (req.body) webLogger.debug(JSON.stringify(req.body));
    };

    res.on('finish', log);
    res.on('close', log);
    next();
};
