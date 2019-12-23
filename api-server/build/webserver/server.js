/**
 * @link https://github.com/bitwave-tv/bitwave-media-server
 * @copyright 2019 [bitwave.tv]
 * @license GPL-3.0
 */
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// express
var express = require("express");
var bodyParser = require("body-parser");
var compression = require("compression");
var chalk = require("chalk");
// other
var path = require("path");
var Q = require("q");
// modules
var Logger_1 = require("../classes/Logger");
var nodeLogger = Logger_1.default('EXPRS');
var api_1 = require("./api");
// const apiV1 = require('./controllers/api/v1');
// middleware
var expressLogger_1 = require("../webserver/middleware/expressLogger");
/**
 * Class for the bitwave media server, powered by express.js
 */
var BitwaveMediaServer = /** @class */ (function () {
    /**
     * constructs a new express app with prod or dev config
     */
    function BitwaveMediaServer(publicDir) {
        this.__public = publicDir;
        this.app = express();
        if (process.env.BMS_NODEJS_ENV === 'dev')
            this.initDev();
        else
            this.initProd();
    }
    /**
     * add automatic parsers for the body
     */
    BitwaveMediaServer.prototype.addParsers = function () {
        this.app.use(bodyParser.json());
        this.app.use(bodyParser.urlencoded({ extended: true }));
    };
    /**
     * add content compression on responses
     */
    BitwaveMediaServer.prototype.addCompression = function () {
        this.app.use(compression());
    };
    /**
     * add express logger
     */
    BitwaveMediaServer.prototype.addExpressLogger = function () {
        this.app.use('/', expressLogger_1.default);
    };
    /**
     * beautify json response
     */
    BitwaveMediaServer.prototype.beautifyJSONResponse = function () {
        this.app.set('json spaces', 4);
    };
    /**
     * add routes
     */
    BitwaveMediaServer.prototype.addRoutes = function () {
        // router( this.app );
        // this.app.use('/v1', apiV1);
        this.app.use('/', api_1.default);
    };
    /**
     * add 404 error handling on pages, that have not been found
     */
    BitwaveMediaServer.prototype.add404ErrorHandling = function () {
        this.app.use(function (req, res, next) {
            var err = new Error(chalk.gray("[404] Error " + req.url));
            res.status(404);
            next(err);
        });
    };
    /**
     * add ability for internal server errors
     */
    BitwaveMediaServer.prototype.add500ErrorHandling = function () {
        this.app.use(function (err, req, res, next) {
            nodeLogger.error(err);
            res.status(err.status || 500);
            res.send({ message: err.message, error: {} });
        });
    };
    /**
     * start the webserver and open the websocket
     * @returns {*|promise}
     */
    BitwaveMediaServer.prototype.startWebserver = function () {
        var _this = this;
        var deferred = Q.defer();
        nodeLogger.info('Starting Node.js API server . . .');
        this.app.set('port', process.env.BMS_NODEJS_PORT);
        var server = this.app.listen(this.app.get('port'), function () {
            _this.app.set('server', server.address());
            nodeLogger.info("Node.js API server running on " + process.env.BMS_NODEJS_PORT);
            deferred.resolve(server.address().port);
        });
        return deferred.promise;
    };
    /**
     * stuff that have always to be added to the webapp
     */
    BitwaveMediaServer.prototype.initAlways = function () {
        this.addParsers();
        this.addCompression();
        this.addExpressLogger();
        this.beautifyJSONResponse();
        this.addRoutes();
    };
    /**
     * prod config for the express app
     */
    BitwaveMediaServer.prototype.initProd = function () {
        var _this = this;
        nodeLogger.debug('Starting API server - PROD environment');
        this.initAlways();
        this.app.get('/', function (req, res) {
            res.sendFile(path.join(_this.__public, 'index.prod.html'));
        });
        this.add404ErrorHandling();
        this.add500ErrorHandling();
    };
    /**
     * dev config for the express app
     */
    BitwaveMediaServer.prototype.initDev = function () {
        var _this = this;
        nodeLogger.debug('Starting API server - DEV environment');
        this.initAlways();
        this.app.get('/', function (req, res) {
            res.sendFile(path.join(_this.__public, 'index.dev.html'));
        });
        this.add404ErrorHandling();
        this.add500ErrorHandling();
    };
    return BitwaveMediaServer;
}());
exports.bitwaveMediaServer = function (publicDir) { return new BitwaveMediaServer(publicDir); };
//# sourceMappingURL=server.js.map