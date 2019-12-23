"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var FfmpegCommand = require('fluent-ffmpeg');
var Transcoder = /** @class */ (function () {
    function Transcoder() {
        this.transcoders = [];
    }
    Transcoder.prototype.startTranscoder = function (user) {
        var _this = this;
        // Check for existing transcoders
        var transcoder = this.transcoders.find(function (t) { return t.user.toLowerCase() === user.toLowerCase(); });
        if (transcoder && transcoder.process !== null) {
            console.log(user + " is already being transcoded.");
            return;
        }
        var ffmpeg;
        // let ffprobe;
        console.log("Start transcoding " + user);
        var inputStream = "rtmp://nginx-server/live/" + user;
        var outputStream = "rtmp://nginx-server/transcode/" + user;
        ffmpeg = new FfmpegCommand(inputStream, { stdoutLines: 1 });
        ffmpeg.input(inputStream);
        ffmpeg.inputOptions([
            '-re',
            '-err_detect ignore_err',
            '-stats',
        ]);
        ffmpeg.output(outputStream + "_144");
        ffmpeg.outputOptions([
            '-f flv',
            '-map_metadata -1',
            '-metadata application=bitwavetv/transcoder',
            // Audio (copy)
            '-c:a copy',
            // '-map 0:{audioid}', // audioid
            // Video (transcode)
            '-c:v libx264',
            '-preset:v veryfast',
            '-b:v 250k',
            // '-maxrate {bitrate}k', // bitrate
            // '-bufsize {bitrate}k', // bitrate
            // '-r {fps}', // fps
            '-g 60',
            '-pix_fmt yuv420p',
            // '-map 0:{videoid}', // videoid
            '-vsync 1',
            // custom
            '-crf 35',
            '-muxdelay 0',
            '-copyts',
            // '-profile:v {profile}', // profile
            '-tune zerolatency',
        ]).size('256x144').autopad();
        ffmpeg.output(outputStream + "_480");
        ffmpeg.outputOptions([
            '-f flv',
            '-map_metadata -1',
            '-metadata application=bitwavetv/transcoder',
            // Audio (copy)
            '-c:a copy',
            // '-map 0:{audioid}', // audioid
            // Video (transcode)
            '-c:v libx264',
            '-preset:v veryfast',
            '-b:v 500k',
            // '-maxrate {bitrate}k', // bitrate
            // '-bufsize {bitrate}k', // bitrate
            // '-r {fps}', // fps
            '-g 60',
            '-pix_fmt yuv420p',
            // '-map 0:{videoid}', // videoid
            '-vsync 1',
            // custom
            '-crf 35',
            '-muxdelay 0',
            '-copyts',
            // '-profile:v {profile}', // profile
            '-tune zerolatency',
        ]).size('854x480').autopad();
        ffmpeg.output(outputStream + "_src?user=" + user);
        ffmpeg.outputOptions([
            // Global
            '-f flv',
            '-map_metadata -1',
            '-metadata application=bitwavetv/transcoder',
            // Audio (copy)
            '-codec:a copy',
            // '-map 0:{audioid}', // audioid
            // Video
            '-codec:v copy',
            // '-map 0:{videoid}', //videoid
            '-vsync 0',
            '-copyts',
            '-start_at_zero'
        ]);
        ffmpeg
            .on('start', function (commandLine) {
            console.log("Starting transcode stream.");
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
            console.log("Stream transcoding ended.");
            _this.transcoders.find(function (t) { return t.user.toLowerCase() === user.toLowerCase(); }).process = null;
            // retry
        })
            .on('error', function (error, stdout, stderr) {
            console.log("Stream transcoding error!");
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
    };
    Transcoder.prototype.stopTranscoder = function (user) {
        var transcoder = this.transcoders.find(function (t) { return t.user.toLowerCase() === user.toLowerCase(); });
        if (transcoder.process !== null) {
            transcoder.process.kill('SIGKILL');
            console.log("Stopping transcoder!");
        }
        else {
            console.log("Transcoding process not running for " + user + ".");
        }
    };
    return Transcoder;
}());
exports.transcoder = new Transcoder();
//# sourceMappingURL=Transcoder.js.map