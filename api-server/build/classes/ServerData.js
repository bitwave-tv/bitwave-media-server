"use strict";
// Created by xander on 12/16/2019
Object.defineProperty(exports, "__esModule", { value: true });
var Logger_1 = require("./Logger");
var log = Logger_1.default('SDATA');
var fluent_ffmpeg_1 = require("fluent-ffmpeg");
/**
 * @const {string} - The RTMP endpoint we will probe for data
 */
var rtmpServer = 'rtmp://nginx-server/live';
var ServerData = /** @class */ (function () {
    function ServerData() {
        this.streamers = new Map();
    }
    /**
     * Adds and tracks new streamer
     * @param {string} streamer
     * @return {void}
     */
    ServerData.prototype.addStreamer = function (streamer) {
        var streamerData = {
            name: streamer,
            timestamp: Date.now(),
            format: {},
            video: [],
            audio: [],
        };
        this.streamers.set(streamer, streamerData);
        // Probe input stream
        this.probeStream(streamer);
    };
    /**
     * Uses ffprobe to get stream data
     * @param {string} streamer
     */
    ServerData.prototype.probeStream = function (streamer) {
        var _this = this;
        var endpoint = rtmpServer + "/" + streamer;
        try {
            fluent_ffmpeg_1.ffprobe(endpoint, function (err, data) {
                if (err) {
                    log.error(err);
                    return;
                }
                log.info(JSON.stringify(data));
                var streams = data.streams;
                var videoStream = streams.filter(function (stream) { return stream.codec_type === 'video'; });
                var audioStream = streams.filter(function (stream) { return stream.codec_type === 'audio'; });
                var format = data.format;
                _this.updateStreamerData(streamer, videoStream, audioStream, format);
            });
        }
        catch (error) {
            log.error(error);
        }
    };
    /**
     * Updates Stream Data from ffprobe data
     * @param {string} streamer
     * @param {FfprobeStream[]} videoStream
     * @param {FfprobeStream[]} audioStream
     * @param {FfprobeFormat} format
     * @return {void} - the result of this function has no use
     */
    ServerData.prototype.updateStreamerData = function (streamer, videoStream, audioStream, format) {
        // Ensure we haven't removed the streamer
        if (!this.streamers.has(streamer))
            return;
        // Get streamer's data
        var data = this.streamers.get(streamer);
        data.timestamp = Date.now();
        // Update video stream data
        data.video = [];
        if (videoStream) {
            videoStream.forEach(function (vs) {
                data.video.push({
                    duration: vs.start_time / 60,
                    codec: vs.codec_name,
                    bitrate: Number(vs.bit_rate),
                    fps: vs.avg_frame_rate,
                    keyframes: vs.has_b_frames,
                    resolution: {
                        width: vs.width,
                        height: vs.height,
                    }
                });
            });
        }
        // Update audio stream data
        data.audio = [];
        if (audioStream) {
            audioStream.forEach(function (as) {
                data.audio.push({
                    codec: as.codec_name,
                    bitrate: Number(as.bit_rate),
                    samplerate: as.sample_rate,
                    channels: as.channels,
                });
            });
        }
        // Update format data
        if (format) {
            data.format = {
                filename: format.filename,
                start_time: format.start_time,
                probe_score: format.probe_score,
                tags: format.tags,
            };
        }
        // Update streamer's data in the map
        this.streamers.set(streamer, data);
    };
    /**
     * Remove livestreamer from map
     * @param {string} streamer
     * @return {void}
     */
    ServerData.prototype.removeStreamer = function (streamer) {
        this.streamers.delete(streamer);
    };
    /**
     * Gets an array of active streamers
     * @return {string[]}
     */
    ServerData.prototype.getStreamerList = function () {
        return Array.from(this.streamers.keys());
    };
    /**
     * Gets case sensitive streamer name from insensitive input
     * @param {string} streamer
     * @return {string|undefined} -returns undefined if failed to find streamer
     */
    ServerData.prototype.getStreamer = function (streamer) {
        return this.getStreamerList()
            .find(function (val) { return val.toLowerCase() === streamer.toLowerCase(); });
    };
    /**
     * Gets streamer data from username
     * @param {string} streamer
     * @return {IStreamerData|null} - returns null if failed to find streamer
     */
    ServerData.prototype.getStreamerData = function (streamer) {
        var user = this.getStreamer(streamer);
        if (!user || !this.streamers.has(user))
            return null;
        return this.streamers.get(user); // Gets streamer data
    };
    /**
     * Requests a server update of streamer data
     * @param {string} streamer
     * @return {boolean} - returns false if failed to find streamer
     */
    ServerData.prototype.updateStreamer = function (streamer) {
        var user = this.getStreamer(streamer);
        if (!user)
            return false;
        this.probeStream(user);
        return true;
    };
    return ServerData;
}());
exports.serverData = new ServerData();
//# sourceMappingURL=ServerData.js.map