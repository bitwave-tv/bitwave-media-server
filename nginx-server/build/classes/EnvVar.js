/**
 * @file holds the code for the class EnvVar
 * @link https://github.com/bitwave-tv/bitwave-media-server
 * @copyright 2019 [bitwave.tv]
 * @license GPL-3.0
 */
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var logBlacklist = ['BMS_PASSWORD'];
/**
 * Class for environment variables with default values
 */
var EnvVar = /** @class */ (function () {
    function EnvVar() {
        this.reset();
    }
    EnvVar.prototype.log = function (message, level) {
        this.messages.push({ level: level, message: message });
    };
    EnvVar.prototype.init = function (config) {
        // Cycle through all defined environment variables
        for (var _i = 0, _a = config.envVars; _i < _a.length; _i++) {
            var envVar_1 = _a[_i];
            // Check if the environment variable is set. If not, cycle through the aliases.
            if (!(envVar_1.name in process.env)) {
                for (var i in envVar_1.alias) {
                    var alias = envVar_1.alias[i];
                    // If the alias exists, copy it to the actual name and delete it.
                    if (alias in process.env) {
                        this.log("The use of " + alias + " is deprecated. Please use " + envVar_1.name + " instead", 'warn');
                        process.env[envVar_1.name] = process.env[alias];
                        delete process.env[alias];
                    }
                }
            }
            // Check if the environment variable is set and display it, if it is not set
            // apply the default value. In case the environment variable is required and
            // not set, stop the process.
            if (envVar_1.name in process.env) {
                // Cover blacklisted values
                var value = process.env[envVar_1.name];
                if (logBlacklist.indexOf(envVar_1.name) !== -1)
                    value = '******';
                this.log(envVar_1.name + " = " + value + " - " + envVar_1.description, 'info');
            }
            else {
                if (envVar_1.required === true) {
                    this.log(envVar_1.name + " not set, but required", 'error');
                    this.errors = true;
                }
                else {
                    this.log(envVar_1.name + " = " + envVar_1.defaultValue + " (default) - " + envVar_1.description, 'info');
                    process.env[envVar_1.name] = envVar_1.defaultValue;
                }
            }
        }
    };
    EnvVar.prototype.list = function (logger) {
        for (var i = 0; i < this.messages.length; i++) {
            var m = this.messages[i];
            switch (m.level) {
                case 'info':
                    logger.info(m.message, 'ENV');
                    break;
                case 'warn':
                    logger.warn(m.message, 'ENV');
                    break;
                case 'error':
                    logger.error(m.message, 'ENV');
                    break;
                default:
                    break;
            }
        }
        this.messages = [];
    };
    EnvVar.prototype.hasErrors = function () {
        return this.errors;
    };
    EnvVar.prototype.reset = function () {
        this.messages = [];
        this.errors = false;
    };
    return EnvVar;
}());
exports.envVar = new EnvVar;
//# sourceMappingURL=EnvVar.js.map