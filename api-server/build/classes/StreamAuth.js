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
var Logger_1 = require("./Logger");
var log = Logger_1.default('AUTH');
var ServerData_1 = require("./ServerData");
var chalk = require("chalk");
var admin = require("firebase-admin");
var rp = require("request-promise");
// Do not attempt to log credentials for CI/CD pipeline
var CICD = process.env['CICD'] === 'true';
if (!CICD) {
    var serviceAccount = require('../../creds/service-account.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: 'https://bitwave-7f415.firebaseio.com',
    });
}
var hlsStream = "hls";
var transcodeStream = "transcode";
var thumbnail = "preview";
var StreamAuth = /** @class */ (function () {
    function StreamAuth(config) {
        this.hostServer = config.hostServer;
        this.cdnServer = config.cdnServer;
    }
    /**
     * Retrieves a user's stream key if available
     * @param {string} username - The user whose key to retrieve
     * @returns {Promise<string|null>} - Returns key if found, else null
     */
    StreamAuth.prototype.getStreamKey = function (username) {
        return __awaiter(this, void 0, void 0, function () {
            var streamRef, docs, key;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        streamRef = admin.firestore()
                            .collection('users')
                            .where('_username', '==', username.toLowerCase())
                            .limit(1);
                        return [4 /*yield*/, streamRef.get()];
                    case 1:
                        docs = _a.sent();
                        if (!docs.empty) {
                            key = docs.docs[0].get('streamkey');
                            if (!!key)
                                return [2 /*return*/, key]; // User has a key
                            if (key === undefined)
                                log.info(username + " does not have a key! (undefined)");
                            else
                                log.info(chalk.bgRedBright.black(' ERROR: ') + " " + username + "'s key is invalid! '" + key + "'");
                            return [2 /*return*/, null];
                        }
                        else {
                            log.info(chalk.bgRedBright.black(' ERROR: ') + "  User " + chalk.bgYellowBright(username) + " could not be found!");
                            return [2 /*return*/, null];
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    ;
    /**
     * Verify & Authorize a user's stream via streamkey
     * @param {string} username - name of user attempting to stream
     * @param {string} key - user's streamkey
     * @returns {Promise<boolean>} - Returns true if user's streamkey matches database
     */
    StreamAuth.prototype.checkStreamKey = function (username, key) {
        return __awaiter(this, void 0, void 0, function () {
            var streamKey;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!key) {
                            log.info(chalk.bgRedBright.black(' ERROR: ') + " " + username + " did not provide a streamkey.");
                            return [2 /*return*/, false];
                        }
                        return [4 /*yield*/, this.getStreamKey(username)];
                    case 1:
                        streamKey = _a.sent();
                        if (!streamKey) {
                            log.info(chalk.bgRedBright.black(' ERROR: ') + " " + username + " does not have a stream key");
                            return [2 /*return*/, false];
                        }
                        if (key !== streamKey) {
                            log.info(chalk.bgRedBright.black(' ERROR: ') + " " + username + " supplied an invalid streamkey");
                            return [2 /*return*/, false];
                        }
                        if (key === streamKey) {
                            log.info(chalk.bgGreenBright.black(' SUCCESS: ') + " " + username + "'s stream authorized");
                            return [2 /*return*/, true];
                        }
                        log.info(chalk.bgRedBright.black(' ERROR: ') + " Unknown fail condiiton while attempting to authorize stream!");
                        return [2 /*return*/, false];
                }
            });
        });
    };
    ;
    /**
     * Set streamer live status and transcode status
     * @param {string} username - Streamer's username
     * @param {boolean} state - LIVE / OFFLINE status
     * @return {Promise<void>}
     */
    StreamAuth.prototype.setLiveStatus = function (username, state) {
        return __awaiter(this, void 0, void 0, function () {
            var streamRef, doc, streamUrl, thumbUrl;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        streamRef = admin.firestore().collection('streams').doc(username.toLowerCase());
                        return [4 /*yield*/, streamRef.get()];
                    case 1:
                        doc = _a.sent();
                        if (!doc.exists) {
                            log.info(chalk.bgRedBright.black('ERROR:') + " " + username + " is not a valid streamer");
                            return [2 /*return*/];
                        }
                        streamUrl = "https://" + this.cdnServer + "/" + hlsStream + "/" + username + "/index.m3u8";
                        thumbUrl = "https://" + this.cdnServer + "/" + thumbnail + "/" + username + ".png";
                        return [4 /*yield*/, streamRef.update({
                                live: state,
                                url: streamUrl,
                                thumbnail: thumbUrl,
                                rtmp: username,
                                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                            })];
                    case 2:
                        _a.sent();
                        if (state) {
                            ServerData_1.serverData.addStreamer(username);
                        }
                        else {
                            ServerData_1.serverData.removeStreamer(username);
                        }
                        log.info(chalk.cyanBright(username) + " is now " + (state ? chalk.greenBright.bold('LIVE') : chalk.redBright.bold('OFFLINE')));
                        return [2 /*return*/];
                }
            });
        });
    };
    ;
    /**
     * Set transcode status and livestream endpoint
     * @param {string} username - Streamer's username
     * @param {boolean} transcoded - Transcode status
     * @return {Promise<void>}
     */
    StreamAuth.prototype.setTranscodeStatus = function (username, transcoded) {
        return __awaiter(this, void 0, void 0, function () {
            var streamRef, doc, url;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        streamRef = admin.firestore().collection('streams').doc(username.toLowerCase());
                        return [4 /*yield*/, streamRef.get()];
                    case 1:
                        doc = _a.sent();
                        if (!doc.exists) {
                            log.info(chalk.bgRedBright.black('ERROR:') + " " + username + " is not a valid streamer");
                            return [2 /*return*/];
                        }
                        if (transcoded) {
                            url = "https://" + this.cdnServer + "/" + transcodeStream + "/" + username + ".m3u8";
                        }
                        else {
                            url = "https://" + this.cdnServer + "/" + hlsStream + "/" + username + "/index.m3u8";
                        }
                        return [4 /*yield*/, streamRef.update({
                                url: url,
                            })];
                    case 2:
                        _a.sent();
                        log.info(chalk.cyanBright(username) + "'s transcoder has " + (transcoded ? chalk.greenBright.bold('started') : chalk.redBright.bold('stopped')) + ".");
                        return [2 /*return*/];
                }
            });
        });
    };
    ;
    /**
     * Check streamer's archive setting
     * @param {string} username - Streamer's username
     * @return {Promise<boolean>}
     */
    StreamAuth.prototype.checkArchive = function (username) {
        return __awaiter(this, void 0, void 0, function () {
            var streamRef, doc, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        streamRef = admin.firestore().collection('streams').doc(username.toLowerCase());
                        return [4 /*yield*/, streamRef.get()];
                    case 1:
                        doc = _a.sent();
                        if (!doc.exists) {
                            log.info(chalk.bgRedBright.black('ERROR:') + " " + username + " is not a valid streamer");
                            return [2 /*return*/];
                        }
                        data = doc.data();
                        return [2 /*return*/, !!data.archive];
                }
            });
        });
    };
    ;
    /**
     * Passes archive information to API server
     * @param {string} username
     * @param {string} location
     * @return {Promise<void>}
     */
    StreamAuth.prototype.saveArchive = function (username, location) {
        return __awaiter(this, void 0, void 0, function () {
            var options, response, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        options = {
                            headers: {
                                'content-type': 'application/x-www-form-urlencoded',
                            },
                            form: {
                                server: this.hostServer,
                                username: username,
                                location: location,
                            },
                        };
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, rp.post('https://api.bitwave.tv/api/archives/add', options)];
                    case 2:
                        response = _a.sent();
                        log.info(response);
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        log.info(error_1);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    ;
    /**
     * Verifies user token & checks if user is admin
     * @param {string} token
     * @return {Promise<boolean>}
     */
    StreamAuth.prototype.verifyAdminToken = function (token) {
        return __awaiter(this, void 0, void 0, function () {
            var decodedToken, uid, userDoc, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, admin.auth().verifyIdToken(token)];
                    case 1:
                        decodedToken = _a.sent();
                        uid = decodedToken.uid;
                        return [4 /*yield*/, admin.firestore().collection('users').doc(uid).get()];
                    case 2:
                        userDoc = _a.sent();
                        data = userDoc.data();
                        // Check if user has admin role
                        return [2 /*return*/, data.hasOwnProperty('role')
                                ? data.role === 'admin'
                                : false];
                }
            });
        });
    };
    return StreamAuth;
}());
exports.streamAuth = function (config) { return new StreamAuth(config); };
//# sourceMappingURL=StreamAuth.js.map