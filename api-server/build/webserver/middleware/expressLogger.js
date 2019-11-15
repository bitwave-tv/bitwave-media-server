/**
 * @file express logger, that logs in the format of the BMS logger
 * @link https://github.com/bitwave-tv/bitwave-media-server
 * @copyright 2019 [bitwave.tv]
 * @license GPL-3.0
 */
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var Logger_1 = require("../../classes/Logger");
var webLogger = Logger_1.default('API');
exports.default = (function (req, res, next) {
    req._startTime = new Date();
    var log = function () {
        var code = res.statusCode;
        var url = (req.originalUrl || req.url);
        webLogger.debug(req.method + " \"" + url + "\" " + code + " " + req.ip);
        if (req.body)
            webLogger.debug(req.body.app + "|" + req.body.name);
    };
    res.on('finish', log);
    res.on('close', log);
    next();
});
//# sourceMappingURL=expressLogger.js.map