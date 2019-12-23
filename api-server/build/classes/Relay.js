"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var FfmpegCommand = require("fluent-ffmpeg");
var chalk = require("chalk");
var Logger_1 = require("../classes/Logger");
var relayLogger = Logger_1.default('RELAY');
var StreamRelay = /** @class */ (function () {
    function StreamRelay() {
        this.transcoders = [];
    }
    StreamRelay.prototype.startRelay = function (user) {
        var _this = this;
        // Check for existing HLS relay
        var transcoder = this.transcoders.find(function (t) { return t.user.toLowerCase() === user.toLowerCase(); });
        if (transcoder && transcoder.process !== null) {
            relayLogger.error(chalk.redBright(user + " is already being streamed."));
            return false;
        }
        relayLogger.info(chalk.greenBright("Start HLS stream for " + user));
        var inputStream = "rtmp://nginx-server/live/" + user;
        var outputStream = "rtmp://nginx-server/hls/" + user;
        var ffmpeg = FfmpegCommand(inputStream, { stdoutLines: 1 });
        // const ffmpeg = FfmpegCommand();
        ffmpeg.input(inputStream);
        ffmpeg.inputOptions([
            '-re',
            '-err_detect ignore_err',
            '-stats',
        ]);
        ffmpeg.output(outputStream + "?user=" + user);
        ffmpeg.outputOptions([
            // Global
            '-f flv',
            '-map_metadata -1',
            '-metadata application=bitwavetv/livestream',
            // Audio (copy)
            '-codec:a copy',
            // '-map 0:{audioid}', // audioid
            // Video
            '-codec:v copy',
            // '-map 0:{videoid}', //videoid
            // Extra
            '-vsync 0',
            '-copyts',
            '-start_at_zero'
        ]);
        ffmpeg
            .on('start', function (commandLine) {
            relayLogger.info(chalk.yellowBright("Starting stream relay."));
            console.log(commandLine);
            _this.transcoders.push({
                user: user,
                process: ffmpeg,
                data: {
                    frames: 0,
                    fps: 0,
                    bitRate: 0,
                    time: 0,
                },
            });
        })
            .on('end', function () {
            relayLogger.info(chalk.redBright("Livestream ended."));
            _this.transcoders.find(function (t) { return t.user.toLowerCase() === user.toLowerCase(); }).process = null;
            // retry
        })
            .on('error', function (error, stdout, stderr) {
            relayLogger.error("Stream relay error!");
            console.log(error);
            console.log(stdout);
            console.log(stderr);
            _this.transcoders.find(function (t) { return t.user.toLowerCase() === user.toLowerCase(); }).process = null;
            // retry
        })
            .on('progress', function (progress) {
            _this.transcoders.find(function (t) { return t.user.toLowerCase() === user.toLowerCase(); }).data = {
                frames: progress.frames,
                fps: progress.currentFps,
                bitRate: progress.currentKbps,
                time: progress.timemark,
            };
            // console.log(`${progress.frames} FPS:${progress.currentFps} ${(progress.currentKbps / 1000).toFixed(1)}Mbps - ${progress.timemark}`);
        });
        ffmpeg.run();
        return true;
    };
    StreamRelay.prototype.stopRelay = function (user) {
        var transcoder = this.transcoders.find(function (t) { return t.user.toLowerCase() === user.toLowerCase(); });
        if (transcoder.process !== null) {
            transcoder.process.kill('SIGKILL');
            relayLogger.info("Stopping HLS stream!");
            return true;
        }
        else {
            relayLogger.error("HLS Streaming process not running for " + user + ".");
            return false;
        }
    };
    return StreamRelay;
}());
exports.hlsRelay = new StreamRelay();
//# sourceMappingURL=Relay.js.map