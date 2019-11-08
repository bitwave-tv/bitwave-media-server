/**
 * @file holds the code for the class NGINX
 * @link https://github.com/bitwave-tv/bitwave-media-server
 * @copyright 2019 [bitwave.tv]
 * @license GPL-3.0
 */
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var child_process_1 = require("child_process");
var Logger_1 = require("./Logger");
var Q = require("q");
var rp = require("request-promise");
var abort;
/**
 * Class to watch and control the NGINX RTMP server process
 */
var Nginxrtmp = /** @class */ (function () {
    /**
     * Constructs the NGINX rtmp with injection of config to use
     * @param config
     */
    function Nginxrtmp(config) {
        this.config = config;
        this.logger = Logger_1.default('NGINX');
        this.process = null; // Process handler
        this.allowRestart = false; // Whether to allow restarts. Restarts are not allowed until the first successful start
    }
    /**
     * Start the NGINX server
     * @returns {Promise.<boolean>}
     */
    Nginxrtmp.prototype.start = function (useSSL) {
        return __awaiter(this, void 0, void 0, function () {
            var timeout, running;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.logger.info('Starting NGINX ...');
                        timeout = 250;
                        abort = false;
                        if (!useSSL) {
                            this.process = child_process_1.spawn(this.config.nginx.command, this.config.nginx.args);
                        }
                        else {
                            this.logger.info('Enabling HTTPS');
                            this.process = child_process_1.spawn(this.config.nginx.command, this.config.nginx.args_ssl);
                        }
                        this.process.stdout.on('data', function (data) {
                            var lines = data.toString().split(/[\r\n]+/);
                            for (var i = 0; i < lines.length; i++) {
                                var line = lines[i].replace(/^.*]/, '').trim();
                                if (line.length === 0) {
                                    continue;
                                }
                                _this.logger.info(line);
                            }
                        });
                        this.process.stderr.on('data', function (data) {
                            var lines = data.toString().split(/[\r\n]+/);
                            for (var i = 0; i < lines.length; i++) {
                                var line = lines[i].replace(/^.*]/, '').trim();
                                if (line.length === 0) {
                                    continue;
                                }
                                _this.logger.error(line);
                            }
                        });
                        this.process.on('close', function (code) {
                            abort = true;
                            _this.logger.error("NGINX Exited with code: " + code);
                            if (code < 0) {
                                return;
                            }
                            if (_this.allowRestart === true) {
                                var self_1 = _this;
                                setTimeout(function () {
                                    self_1.logger.info('Trying to restart NGINX ...');
                                    self_1.start();
                                }, timeout);
                            }
                        });
                        this.process.on('error', function (err) {
                            _this.logger.error("Failed to spawn NGINX process: " + err.name + ": " + err.message);
                        });
                        running = false;
                        _a.label = 1;
                    case 1:
                        if (!!running) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.isRunning(timeout)];
                    case 2:
                        running = _a.sent();
                        if (abort === true) {
                            this.logger.info('Aborted');
                            return [3 /*break*/, 3];
                        }
                        return [3 /*break*/, 1];
                    case 3:
                        if (running === false) {
                            this.process = null;
                            throw new Error('Failed to start NGINX');
                        }
                        else {
                            this.allowRestart = true;
                            this.logger.info('Successfully started NGINX');
                        }
                        return [2 /*return*/, true];
                }
            });
        });
    };
    /**
     * Get current state of the NGINX server
     * @returns {Promise.<boolean>}
     */
    Nginxrtmp.prototype.isRunning = function (delay) {
        return __awaiter(this, void 0, void 0, function () {
            var url, response, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        url = "http://" + this.config.nginx.streaming.ip + ":" + this.config.nginx.streaming.http_port + this.config.nginx.streaming.http_health_path;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, Q.delay(delay)];
                    case 2:
                        _a.sent(); // delay the state detection by the given amount of milliseconds
                        return [4 /*yield*/, rp(url)];
                    case 3:
                        response = _a.sent();
                        return [2 /*return*/, response === 'pong'];
                    case 4:
                        error_1 = _a.sent();
                        console.log(error_1);
                        return [2 /*return*/, false];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    return Nginxrtmp;
}());
exports.default = (function (config) { return new Nginxrtmp(config); });
//# sourceMappingURL=Nginxrtmp.js.map