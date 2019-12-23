"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var FfmpegCommand = require("fluent-ffmpeg");
var chalk = require("chalk");
var Logger_1 = require("../classes/Logger");
var restreamLogger = Logger_1.default('RSTRM');
var Restreamer = /** @class */ (function () {
    function Restreamer() {
        this.restreams = [];
    }
    Restreamer.prototype.startRestream = function (user, restreamServeer, restreamKey) {
        var _this = this;
        // Check for existing restreamer
        var restreamer = this.restreams.find(function (t) { return t.user.toLowerCase() === user.toLowerCase(); });
        if (restreamer && restreamer.process !== null) {
            restreamLogger.error(chalk.redBright(user + " is already being streamed."));
            return false;
        }
        restreamLogger.info(chalk.greenBright("Start restream for " + user));
        var inputStream = "rtmp://nginx-server/live/" + user;
        var outputStream = restreamServeer + "/" + restreamKey;
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
            restreamLogger.info(chalk.yellowBright("Starting restreamer."));
            console.log(commandLine);
            _this.restreams.push({
                user: user,
                remoteService: restreamServeer,
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
            restreamLogger.info(chalk.redBright("Restream ended."));
            _this.restreams.find(function (t) { return t.user.toLowerCase() === user.toLowerCase(); }).process = null;
            // retry
        })
            .on('error', function (error, stdout, stderr) {
            restreamLogger.error("Restreaming error!");
            console.log(error);
            console.log(stdout);
            console.log(stderr);
            _this.restreams.find(function (t) { return t.user.toLowerCase() === user.toLowerCase(); }).process = null;
            // retry
        })
            .on('progress', function (progress) {
            _this.restreams.find(function (t) { return t.user.toLowerCase() === user.toLowerCase(); }).data = {
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
    Restreamer.prototype.stopRestream = function (user) {
        var transcoder = this.restreams.find(function (t) { return t.user.toLowerCase() === user.toLowerCase(); });
        if (transcoder.process !== null) {
            transcoder.process.kill('SIGKILL');
            restreamLogger.info("Stopping restreamer!");
            return true;
        }
        else {
            restreamLogger.error("Restreamer process not running for " + user + ".");
            return false;
        }
    };
    return Restreamer;
}());
exports.restreamer = new Restreamer();
//# sourceMappingURL=Restream.js.map