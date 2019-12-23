"use strict";
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
var admin = require("firebase-admin");
var body = require('express-validator').body;
exports.validateUserToken = function () {
    return [
        body('user').isString(),
        body('token').isJWT,
    ];
};
/**
 * Returns user profile data for a given uid
 * @param uid
 */
var getUserData = function (uid) { return __awaiter(void 0, void 0, void 0, function () {
    var userDocument;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, admin.firestore()
                    .collection('users')
                    .doc(uid)
                    .get()];
            case 1:
                userDocument = _a.sent();
                return [2 /*return*/, userDocument.data()];
        }
    });
}); };
/**
 * Verifies user token & checks if user is admin
 * @param {FirebaseFirestore.DocumentData} data
 * @return {Promise<boolean>}
 */
var verifyAdmin = function (data) {
    // Check if user has admin role
    return data.hasOwnProperty('role')
        ? data.role === 'admin'
        : false;
};
/**
 * Verifies user token matches username
 * @param {FirebaseFirestore.DocumentData} data
 * @param {string} username
 * @return {Promise<boolean>}
 */
var verifyUser = function (data, username) {
    // Check if username matches
    return data.hasOwnProperty('_username')
        ? data._username === username.toLowerCase()
        : false;
};
/**
 * Checks token and verifies user matches username or that they are an admin
 * @param {string} token
 * @param {string} username
 */
var verifyToken = function (token, username) { return __awaiter(void 0, void 0, void 0, function () {
    var uid, data;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                // Require token
                if (!token)
                    return [2 /*return*/, false];
                return [4 /*yield*/, admin.auth().verifyIdToken(token)];
            case 1:
                uid = (_a.sent()).uid;
                return [4 /*yield*/, getUserData(uid)];
            case 2:
                data = _a.sent();
                // Check if username matches token
                if (verifyUser(data, username))
                    return [2 /*return*/, true];
                // Check if user is an admin
                if (verifyAdmin(data))
                    return [2 /*return*/, true];
                // User was not verified, and is not an admin
                console.log('Token verification failed');
                return [2 /*return*/, false];
        }
    });
}); };
exports.authenticatedRequest = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var token, user, authenticated;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                token = req.body.token;
                user = req.body.user;
                return [4 /*yield*/, verifyToken(token, user)];
            case 1:
                authenticated = _a.sent();
                if (authenticated)
                    return [2 /*return*/, next()];
                return [2 /*return*/, res
                        .status(403)
                        .send({
                        errors: [{
                                location: 'Authentication',
                                message: 'Authentication check failed',
                            }],
                    })];
        }
    });
}); };
//# sourceMappingURL=auth.js.map