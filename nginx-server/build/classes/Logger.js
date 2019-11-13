/**
 * @file holds the code for the class Logger
 * @link https://github.com/bitwave-tv/bitwave-media-server
 * @copyright 2019 [bitwave.tv]
 * @license GPL-3.0
 */
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var moment = require("moment-timezone");
var LEVEL_MUTE = 0;
var LEVEL_ERROR = 1;
var LEVEL_WARN = 2;
var LEVEL_INFO = 3;
var LEVEL_DEBUG = 4;
var BMS_LOGLEVEL = 0;
var BMS_DEBUG = false;
/**
 * Class for logger
 */
var Logger = /** @class */ (function () {
    /**
     * construct a logger object
     * @param {string} context context of the log message (classname.methodname)
     */
    function Logger(context) {
        BMS_LOGLEVEL = parseInt(process.env.BMS_LOGLEVEL, 10) || LEVEL_DEBUG;
        BMS_DEBUG = (process.env.BMS_DEBUG === "true");
        this.context = context;
        this.debuglog = null;
        if (BMS_DEBUG === true) {
            var identifier = process.pid + "-" + process.platform + "-" + process.arch;
            try {
                this.debuglog = fs.openSync("/bms-nginx-server/src/webserver/public/debug/BMS-" + identifier + ".txt", 'a');
            }
            catch (err) {
                this.debuglog = null;
                this.stdout("Error opening debug file " + identifier + ": " + err, context, 'INFO');
            }
            finally {
                this.stdout("Enabled logging to " + identifier, context, 'INFO');
            }
        }
    }
    /**
     * check if the logger is muted
     * @returns {boolean}
     */
    Logger.isMuted = function () {
        return parseInt(process.env.BMS_LOGLEVEL, 10) === LEVEL_MUTE;
    };
    Logger.prototype.logline = function (message, context, type) {
        var timezone = process.env.BMS_TIMEZONE || 'America/Los_Angeles';
        var time = moment().tz(timezone).format('DD-MM-YYYY HH:mm:ss.SSS');
        var logline = '';
        if (context)
            logline = "[" + time + "] [" + type.padStart(5, ' ') + "] [" + context.padStart(10, ' ') + "] " + message;
        else
            logline = "[" + time + "] [" + type.padStart(5, ' ') + "] " + message;
        return logline;
    };
    /**
     * print a message to stdout
     * @param {string} message
     * @param {string} context
     * @param {string} type
     */
    Logger.prototype.stdout = function (message, context, type) {
        if (Logger.isMuted())
            return;
        var logline = this.logline(message, context, type);
        process.stdout.write(logline + "\n");
    };
    /**
     * print a message to a file
     * @param {string} message
     * @param {string} context
     * @param {string} type
     */
    Logger.prototype.file = function (message, context, type) {
        var _this = this;
        var logline = this.logline(message, context, type);
        if (this.debuglog !== null) {
            fs.appendFile(this.debuglog, logline + "\n", 'utf8', function (err) {
                // ignore errors
                if (err)
                    return;
                fs.fsync(_this.debuglog, function (err) { return null; });
                return;
            });
        }
    };
    /**
     * print an info message if LOG_LEVEL >= LEVEL_INFO
     * @param {string} message
     * @param {string=} context
     * @param {boolean=} alertGui
     */
    Logger.prototype.info = function (message, context, alertGui) {
        var loggerContext = context;
        var loggerAlertGui = alertGui;
        if (typeof context === 'undefined')
            loggerContext = this.context;
        if (typeof alertGui === 'undefined')
            loggerAlertGui = false;
        if (BMS_DEBUG === true)
            this.file(message, loggerContext, 'INFO');
        if (BMS_LOGLEVEL >= LEVEL_INFO)
            return this.stdout(message, loggerContext, 'INFO');
        // todo: if alertGui is activated on frontend and websockets controller, insert emit here
        if (loggerAlertGui)
            return;
    };
    /**
     * print a warning message if LOG_LEVEL >= LEVEL_WARN
     * @param {string} message
     * @param {string=} context
     * @param {boolean=} alertGui
     */
    Logger.prototype.warn = function (message, context, alertGui) {
        var loggerContext = context;
        var loggerAlertGui = alertGui;
        if (typeof context === 'undefined')
            loggerContext = this.context;
        if (typeof alertGui === 'undefined')
            loggerAlertGui = false;
        if (BMS_DEBUG === true)
            this.file(message, loggerContext, 'WARN');
        if (BMS_LOGLEVEL >= LEVEL_WARN)
            return this.stdout(message, loggerContext, 'WARN');
    };
    /**
     * print a debug message if LOG_LEVEL >= LEVEL_DEBUG
     * @param {string} message
     * @param {string=} context
     * @param {boolean=} alertGui
     */
    Logger.prototype.debug = function (message, context, alertGui) {
        var loggerContext = context;
        var loggerAlertGui = alertGui;
        if (typeof context === 'undefined')
            loggerContext = this.context;
        if (typeof alertGui === 'undefined')
            loggerAlertGui = false;
        if (BMS_DEBUG === true)
            this.file(message, loggerContext, 'DEBUG');
        if (BMS_LOGLEVEL >= LEVEL_DEBUG)
            return this.stdout(message, loggerContext, 'DEBUG');
        // todo: if alertGui is activated on frontend and websockets controller, insert emit here
        if (loggerAlertGui)
            return;
    };
    /**
     * print a debug message if LOG_LEVEL >= LEVEL_ERROR
     * sends a string to
     * @param {string} message
     * @param {string=} context
     * @param {boolean=} alertGui
     */
    Logger.prototype.error = function (message, context, alertGui) {
        var loggerContext = context;
        var loggerAlertGui = alertGui;
        if (typeof context === 'undefined')
            loggerContext = this.context;
        if (typeof alertGui === 'undefined')
            loggerAlertGui = false;
        if (BMS_DEBUG === true)
            this.file(message, loggerContext, 'ERROR');
        if (BMS_LOGLEVEL >= LEVEL_ERROR)
            return this.stdout(message, loggerContext, 'ERROR');
        // todo: if alertGui is activated on frontend and websockets controller, insert emit here
        if (loggerAlertGui)
            return;
    };
    return Logger;
}());
// define log levels in logger class
Logger.LEVEL_ERROR = LEVEL_ERROR;
Logger.LEVEL_WARN = LEVEL_WARN;
Logger.LEVEL_INFO = LEVEL_INFO;
Logger.LEVEL_DEBUG = LEVEL_DEBUG;
exports.default = (function (context) { return new Logger(context); });
//# sourceMappingURL=Logger.js.map