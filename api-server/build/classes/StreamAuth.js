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
// import logger from '../../classes/Logger';
// const webLogger = logger('webserver');
var admin = require("firebase-admin");
var serviceAccount = require('../../creds/service-account.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://bitwave-7f415.firebaseio.com',
});
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
     * @param username - The user whose key to retrieve
     * @returns {Promise<*>} - Returns key if found, else null
     */
    StreamAuth.prototype.getStreamKey = function (username) {
        return __awaiter(this, void 0, void 0, function () {
            var streamRef, docs, key;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        streamRef = admin.firestore().collection('users').where('_username', '==', username.toLowerCase()).limit(1);
                        return [4 /*yield*/, streamRef.get()];
                    case 1:
                        docs = _a.sent();
                        if (!docs.empty) {
                            key = docs.docs[0].get('streamkey');
                            if (!!key) {
                                return [2 /*return*/, key]; // User has a key
                            }
                            if (key === undefined)
                                console.log(username + " does not have a key! (undefined)");
                            else
                                console.log("\u001B[91mERROR:\u001B[0m " + username + "'s key is invalid! " + key);
                            return [2 /*return*/, null];
                        }
                        else {
                            console.log("\u001B[91mERROR:\u001B[0m User \u001B[1m\u001B[36m" + username + "\u001B[0m could not be found!");
                            return [2 /*return*/, undefined];
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    ;
    /**
     * Verify & Authorize a user's stream via streamkey
     * @param username - name of user attempting to stream
     * @param key - user's streamkey
     * @returns {Promise<boolean>} - Returns true if user's streamkey matches database
     */
    StreamAuth.prototype.checkStreamKey = function (username, key) {
        return __awaiter(this, void 0, void 0, function () {
            var streamKey;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!key) {
                            console.log("\u001B[91mERROR:\u001B[0m " + username + " did not provide a streamkey");
                            return [2 /*return*/, false];
                        }
                        return [4 /*yield*/, this.getStreamKey(username)];
                    case 1:
                        streamKey = _a.sent();
                        if (!streamKey) {
                            // console.log(`\x1b[91mERROR:\x1b[0m ${username} does not have a stream key`);
                            return [2 /*return*/, false];
                        }
                        if (key !== streamKey) {
                            console.log("\u001B[91mDENIED:\u001B[0m " + username + " supplied an invalid streamkey");
                            return [2 /*return*/, false];
                        }
                        if (key === streamKey) {
                            console.log("\u001B[1m\u001B[32mSUCCES:\u001B[0m " + username + " stream authorized");
                            return [2 /*return*/, true];
                        }
                        console.log("\u001B[91mERROR:\u001B[0m Unknown fail condiiton while attempting to authorize stream");
                        return [2 /*return*/, false];
                }
            });
        });
    };
    ;
    StreamAuth.prototype.setLiveStatus = function (username, state, transcoded) {
        return __awaiter(this, void 0, void 0, function () {
            var _username, streamRef, doc, url;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _username = username.toLowerCase();
                        streamRef = admin.firestore().collection('streams').doc(_username);
                        return [4 /*yield*/, streamRef.get()];
                    case 1:
                        doc = _a.sent();
                        if (!doc.exists) {
                            console.log("ERROR: " + username + " is not a valid streamer");
                            return [2 /*return*/];
                        }
                        if (transcoded) {
                            url = "https://" + this.cdnServer + "/" + transcodeStream + "/" + username + ".m3u8";
                        }
                        else {
                            url = "https://" + this.cdnServer + "/" + hlsStream + "/" + username + "/index.m3u8";
                        }
                        return [4 /*yield*/, streamRef.update({
                                live: state,
                                url: url,
                                thumbnail: "https://" + this.cdnServer + "/" + thumbnail + "/" + username + ".png",
                            })];
                    case 2:
                        _a.sent();
                        console.log("\u001B[1m\u001B[36m" + username + "\u001B[0m is now \u001B[1m" + (state ? '\x1b[32mLIVE' : '\x1b[91mOFFLINE') + "\u001B[0m");
                        return [2 /*return*/];
                }
            });
        });
    };
    ;
    return StreamAuth;
}());
exports.streamAuth = function (config) { return new StreamAuth(config); };
//# sourceMappingURL=StreamAuth.js.map