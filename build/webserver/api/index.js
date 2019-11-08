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
var Logger_1 = require("../../classes/Logger");
var webLogger = Logger_1.default('Webserver');
var StreamAuth_1 = require("../../classes/StreamAuth");
var streamauth = StreamAuth_1.streamAuth({
    hostServer: process.env['BMS_SERVER_URL'] || 'stream.bitrave.tv',
    cdnServer: process.env['BMS_CDN_URL'] || 'cdn.stream.bitrave.tv',
});
var Transcoder_1 = require("../../classes/Transcoder");
var transcode = new Transcoder_1.Transcoder();
var rp = require("request-promise");
var updateDelay = 10;
var host = 'http://localhost:8080';
var control = 'control';
exports.default = (function (app) {
    // Authorize livestream
    app.post('/stream/authorize', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
        var app, name, key, checkKey;
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
                        res.status(200).send('Auth not required');
                        return [2 /*return*/];
                    }
                    if (!name || !key) {
                        res.sendStatus(500);
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, streamauth.checkStreamKey(name, key)];
                case 1:
                    checkKey = _a.sent();
                    if (checkKey) {
                        setTimeout(function () { return __awaiter(void 0, void 0, void 0, function () {
                            var response, i;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, streamauth.setLiveStatus(name, true, false)];
                                    case 1:
                                        _a.sent();
                                        i = 0;
                                        _a.label = 2;
                                    case 2:
                                        if (!(i < 3)) return [3 /*break*/, 7];
                                        return [4 /*yield*/, rp(host + "/" + control + "/record/start?app=live&name=" + name + "&rec=archive")];
                                    case 3:
                                        response = _a.sent();
                                        if (!!response) return [3 /*break*/, 5];
                                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1000 * 10); })];
                                    case 4:
                                        _a.sent();
                                        console.log("Failed to start archive, attempting again in 10 seconds (" + i + "/3)");
                                        return [3 /*break*/, 6];
                                    case 5:
                                        console.log("Archiving " + name + " to " + response);
                                        return [3 /*break*/, 7];
                                    case 6:
                                        i++;
                                        return [3 /*break*/, 2];
                                    case 7: return [2 /*return*/];
                                }
                            });
                        }); }, updateDelay * 1000);
                        webLogger.info("[" + app + "] \u001B[1m\u001B[36m" + name + "\u001B[0m authorized.");
                        res.status(200)
                            .send(name + " authorized.");
                    }
                    else {
                        webLogger.info("[" + app + "] " + name + " denied.");
                        res.status(403)
                            .send(name + " denied.");
                    }
                    return [2 /*return*/];
            }
        });
    }); });
    // Transcoded stream start
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
                            case 0: return [4 /*yield*/, streamauth.setLiveStatus(user, true, true)];
                            case 1:
                                _a.sent();
                                console.log("[" + app + "] " + user + " is now transcoded.");
                                return [2 /*return*/];
                        }
                    });
                }); }, updateDelay * 1000);
            }
            res.status(200)
                .send("[" + app + "|" + name + "] is transcoding " + user + ".");
            return [2 /*return*/];
        });
    }); });
    // Livestream disconnect
    app.post('/stream/end', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
        var app, name;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    app = req.body.app;
                    name = req.body.name;
                    if (!(app === 'live')) return [3 /*break*/, 2];
                    return [4 /*yield*/, streamauth.setLiveStatus(name, false)];
                case 1:
                    _a.sent();
                    console.log("[" + app + "] \u001B[1m\u001B[36m" + name + "\u001B[0m stopped streaming.");
                    res.status(201)
                        .send("[" + app + "] " + name + " is now OFFLINE");
                    _a.label = 2;
                case 2: return [2 /*return*/];
            }
        });
    }); });
    // Start transcoding stream
    app.post('/stream/start-transcode', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
        var user;
        return __generator(this, function (_a) {
            user = req.body.user;
            console.log(user + " will be transcoded... Starting transcoders...");
            transcode.startTranscoder(user);
            res.status(200)
                .send(user + " is now being transcoded.");
            return [2 /*return*/];
        });
    }); });
    // Stop transcoding stream
    app.post('/stream/stop-transcode', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
        var user;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    user = req.body.user;
                    console.log(user + " will no longer be transcoded.");
                    // Revert streamer endpoint
                    return [4 /*yield*/, streamauth.setLiveStatus(user, true, false)];
                case 1:
                    // Revert streamer endpoint
                    _a.sent();
                    console.log(user + "'s endpoint has been reverted");
                    transcode.stopTranscoder(user);
                    console.log(user + "'s transcoding process has been stopped.");
                    res.status(200)
                        .send(user + " is no longer being transcoded.");
                    return [2 /*return*/];
            }
        });
    }); });
    // Transcoded stream stats
    app.get('/stream/stats', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            res.status(200)
                .send(transcode.transcoders.map(function (t) { return ({ user: t.user, data: t.data }); }));
            return [2 /*return*/];
        });
    }); });
});
//# sourceMappingURL=index.js.map