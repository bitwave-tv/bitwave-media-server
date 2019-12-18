// Created by xander on 10/30/2019
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
var chalk = require("chalk");
var rp = require("request-promise");
var Logger_1 = require("../../classes/Logger");
var apiLogger = Logger_1.default('APIv1');
var StreamAuth_1 = require("../../classes/StreamAuth");
var streamauth = StreamAuth_1.streamAuth({
    hostServer: process.env['BMS_SERVER'] || 'stream.bitrave.tv',
    cdnServer: process.env['BMS_CDN'] || 'cdn.stream.bitrave.tv',
});
var Transcoder_1 = require("../../classes/Transcoder");
var transcode = new Transcoder_1.Transcoder();
var ServerData_1 = require("../../classes/ServerData");
var port = '5000';
var server = 'nginx-server';
var host = "http://" + server + ":" + port;
var control = 'control';
var liveTimers = [];
var updateDelay = 10;
exports.default = (function (app) {
    /*********************************
     * Authorize Streams
     */
    /**
     * Authorize livestream
     */
    app.post('/stream/authorize', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
        var app, name, key, checkKey, checkArchive_1, timer;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    app = req.body.app;
                    name = req.body.name;
                    key = req.body.key;
                    if (!app) {
                        res.sendStatus(404);
                        return [2 /*return*/];
                    }
                    if (app !== 'live') {
                        res.status(200).send([app] + " Auth not required");
                        return [2 /*return*/];
                    }
                    if (!name || !key) {
                        res.sendStatus(500);
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, streamauth.checkStreamKey(name, key)];
                case 1:
                    checkKey = _a.sent();
                    if (!checkKey) return [3 /*break*/, 3];
                    return [4 /*yield*/, streamauth.checkArchive(name)];
                case 2:
                    checkArchive_1 = _a.sent();
                    timer = setTimeout(function () { return __awaiter(void 0, void 0, void 0, function () {
                        var response, i;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: 
                                // Update live status
                                return [4 /*yield*/, streamauth.setLiveStatus(name, true)];
                                case 1:
                                    // Update live status
                                    _a.sent();
                                    // Check if we should archive stream
                                    if (!checkArchive_1) {
                                        apiLogger.info("Archiving is disabled for " + chalk.cyanBright.bold(name));
                                        return [2 /*return*/];
                                    }
                                    i = 0;
                                    _a.label = 2;
                                case 2:
                                    if (!(i < 6)) return [3 /*break*/, 8];
                                    return [4 /*yield*/, rp(host + "/" + control + "/record/start?app=live&name=" + name + "&rec=archive")];
                                case 3:
                                    response = _a.sent();
                                    if (!!response) return [3 /*break*/, 5];
                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1000 * 10); })];
                                case 4:
                                    _a.sent();
                                    apiLogger.info(chalk.redBright('Failed to start archive') + ", attempting again in 10 seconds (" + i + "/6)");
                                    return [3 /*break*/, 7];
                                case 5:
                                    apiLogger.info("Archiving " + chalk.cyanBright.bold(name) + " to " + chalk.greenBright(response));
                                    return [4 /*yield*/, streamauth.saveArchive(name, response)];
                                case 6:
                                    _a.sent();
                                    return [3 /*break*/, 8];
                                case 7:
                                    i++;
                                    return [3 /*break*/, 2];
                                case 8: return [2 /*return*/];
                            }
                        });
                    }); }, updateDelay * 1000);
                    liveTimers.push({
                        user: name,
                        timer: timer,
                    });
                    apiLogger.info("[" + app + "] " + chalk.cyanBright.bold(name) + " authorized.");
                    res.status(200).send(name + " authorized.");
                    return [3 /*break*/, 4];
                case 3:
                    apiLogger.info("[" + app + "] " + chalk.redBright.bold(name) + " denied.");
                    res.status(403).send(name + " denied.");
                    _a.label = 4;
                case 4: return [2 /*return*/];
            }
        });
    }); });
    /**
     * Transcoded stream start
     */
    app.post('/stream/transcode', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
        var user, app, name;
        return __generator(this, function (_a) {
            user = req.body.user;
            app = req.body.app;
            name = req.body.name;
            if (user) {
                setTimeout(function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, streamauth.setTranscodeStatus(user, true)];
                            case 1:
                                _a.sent();
                                apiLogger.info("[" + app + "] " + chalk.cyanBright.bold(user) + " is now " + chalk.greenBright.bold('transcoded') + ".");
                                return [2 /*return*/];
                        }
                    });
                }); }, updateDelay * 1000);
            }
            res.status(200).send("[" + app + "|" + name + "] is transcoding " + user + ".");
            return [2 /*return*/];
        });
    }); });
    /**
     * Livestream disconnect
     */
    app.post('/stream/end', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
        var app, name;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    app = req.body.app;
                    name = req.body.name;
                    if (!(app === 'live')) return [3 /*break*/, 2];
                    // Prevent live from firing if we go offline
                    liveTimers.map(function (val) {
                        if (val.user === name)
                            clearTimeout(val.timer);
                        else
                            return val;
                    });
                    // Set offline status
                    return [4 /*yield*/, streamauth.setLiveStatus(name, false)];
                case 1:
                    // Set offline status
                    _a.sent();
                    apiLogger.info("[" + app + "] " + chalk.cyanBright.bold(name) + " is going " + chalk.redBright.bold('OFFLINE') + ".");
                    res.status(200).send("[" + app + "] " + name + " is now OFFLINE");
                    _a.label = 2;
                case 2: return [2 /*return*/];
            }
        });
    }); });
    /*********************************
     * Commands & Controls
     */
    /**
     * Start transcoding stream
     */
    app.post('/stream/transcode/start', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
        var user;
        return __generator(this, function (_a) {
            user = req.body.user;
            apiLogger.info(chalk.cyanBright.bold(user) + " will be transcoded... Starting transcoders...");
            transcode.startTranscoder(user);
            res.status(200).send(user + " is now being transcoded.");
            return [2 /*return*/];
        });
    }); });
    /**
     * Stop transcoding stream
     */
    app.post('/stream/transcode/stop', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
        var user;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    user = req.body.user;
                    apiLogger.info(chalk.cyanBright.bold(user) + " will no longer be transcoded.");
                    // Revert streamer endpoint
                    return [4 /*yield*/, streamauth.setTranscodeStatus(user, false)];
                case 1:
                    // Revert streamer endpoint
                    _a.sent();
                    apiLogger.info(chalk.cyanBright.bold(user) + "'s endpoint has been reverted");
                    transcode.stopTranscoder(user);
                    apiLogger.info(chalk.cyanBright.bold(user) + "'s transcoding process has been stopped.");
                    res.status(200).send(user + " is no longer being transcoded.");
                    return [2 /*return*/];
            }
        });
    }); });
    /**
     * Start stream recorder
     */
    app.post('/stream/record/start', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
        var name, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    name = req.body.name;
                    return [4 /*yield*/, rp(host + "/" + control + "/record/start?app=live&name=" + name + "&rec=archive")];
                case 1:
                    response = _a.sent();
                    if (!!response) return [3 /*break*/, 2];
                    apiLogger.info(chalk.redBright('Failed to start archive') + ", please try again.");
                    return [3 /*break*/, 4];
                case 2:
                    apiLogger.info("Archiving " + chalk.cyanBright.bold(name) + " to " + chalk.greenBright(response));
                    return [4 /*yield*/, streamauth.saveArchive(name, response)];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    res.status(200).send(!!response ? response : name + " failed to start archive");
                    return [2 /*return*/];
            }
        });
    }); });
    /**
     * Stop stream recorder
     */
    app.post('/stream/record/stop', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
        var name, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    name = req.body.name;
                    return [4 /*yield*/, rp(host + "/" + control + "/record/stop?app=live&name=" + name + "&rec=archive")];
                case 1:
                    response = _a.sent();
                    if (!response) {
                        apiLogger.info(chalk.redBright('Failed to stop archive') + ", please try again.");
                    }
                    else {
                        apiLogger.info("Archive of " + chalk.cyanBright.bold(name) + " saved to " + chalk.greenBright(response));
                    }
                    res.status(200).send(!!response ? response : name + " failed to stop archive");
                    return [2 /*return*/];
            }
        });
    }); });
    /*********************************
     * Stream Data
     */
    /**
     * Transcoded stream stats
     */
    app.get('/stream/stats', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
        var data;
        return __generator(this, function (_a) {
            data = transcode.transcoders.map(function (t) { return ({
                user: t.user,
                ffmpegProc: t.process.ffmpegProc,
                ffprobeData: t.process._ffprobeData,
                data: t.data
            }); });
            res.status(200).send(data);
            return [2 /*return*/];
        });
    }); });
    /**
     * Transcoded stream stats for single user
     */
    app.get('/stream/stats/:user', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
        var data;
        return __generator(this, function (_a) {
            data = transcode.transcoders
                .filter(function (stats) { return stats.user.toLowerCase() === req.params.user.toLowerCase(); })
                .map(function (stats) { return ({ user: stats.user, ffmpegProc: stats.process.ffmpegProc, data: stats.data }); });
            res.status(200)
                .send(transcode.transcoders.filter(function (stats) {
                if (stats.user.toLowerCase() === req.params.user.toLowerCase()) {
                    return { user: stats.user, data: stats.data };
                }
            }));
            return [2 /*return*/];
        });
    }); });
    /*********************************
     * Server Data
     */
    app.get('/server/data', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
        var data;
        return __generator(this, function (_a) {
            data = ServerData_1.serverData.getStreamerList();
            res.status(200).send(data);
            return [2 /*return*/];
        });
    }); });
    app.get('/server/data/:streamer', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
        var streamer, data;
        return __generator(this, function (_a) {
            streamer = req.params.streamer;
            data = ServerData_1.serverData.getStreamerData(streamer);
            // Verify we got data
            if (!data) {
                res.status(404).send('Error: streamer not found');
                return [2 /*return*/];
            }
            // Update streamer's data
            ServerData_1.serverData.updateStreamer(streamer);
            // Send results
            res.status(200).send(data);
            return [2 /*return*/];
        });
    }); });
    /*********************************
     * Admin Commands
     */
    app.post('/admin/drop', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
        var streamer, token, authorized, error_1, name, mode, type, app, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    streamer = req.body.streamer;
                    token = req.body.token;
                    if (!streamer || !token) {
                        res.status(422).send('Missing required parameters');
                        return [2 /*return*/];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, streamauth.verifyAdminToken(token)];
                case 2:
                    authorized = _a.sent();
                    if (!authorized) {
                        res.status(403).send('Authentication Failed');
                        return [2 /*return*/];
                    }
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    res.status(403).send(error_1);
                    return [2 /*return*/];
                case 4:
                    name = ServerData_1.serverData.getStreamer(streamer);
                    // Check if streamer was found
                    if (!name) {
                        res.status(404).send('Streamer not found');
                        return [2 /*return*/];
                    }
                    mode = 'drop';
                    type = 'publisher';
                    app = 'live';
                    return [4 /*yield*/, rp(host + "/" + control + "/" + mode + "/" + type + "?app=" + app + "&name=" + name)];
                case 5:
                    response = _a.sent();
                    // Log results
                    apiLogger.info("Drop " + name + " result: " + response);
                    // Return result
                    res.status(200).send(response);
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=index.js.map