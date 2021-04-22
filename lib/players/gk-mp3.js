/*-------------------------------------------------------------------------------------------------------------------
    Modules
//-------------------------------------------------------------------------------------------------------------------*/
const ytdl = require('ytdl-core'),
    shuffle = require('lodash/shuffle'),
    sortBy = require('lodash/sortBy'),
    throttle = require("lodash/throttle"),
    first = require('lodash/first'),
    last = require('lodash/last'),
    execa = require('execa'),
    EventEmitter = require('eventemitter3'),
    dotProp = require('dot-prop'),
    logUpdate = require('log-update'),
    prettyMs = require('pretty-ms'),
    numbro = require('numbro'),
    clear = require('clear'),
    c = require('ansi-colors'),
    bytes = require('bytes'),
    figlet = require('figlet'),
    isUrl = require('is-url'),
    path = require('path'),
    kindOf = require('kind-of'),

    Conf = require('conf'),
    {
        duration_to_ms,
        stripAnsi,
        truncate_to_window,
        strip_non_ascii
    } = require('../common');


/*-------------------------------------------------------------------------------------------------------------------
    Local
//-------------------------------------------------------------------------------------------------------------------*/

const Cache = require('../cache'),
    EE = new EventEmitter(),
    config = new Conf(),
    ProgressBar = require("../progress-bar"),
    progressBar = new ProgressBar();


class Loghelper {

    progress_bar(time, size = 20) {


        let pcSize, procgressChar = '■',
            pc, str = '';

        if (this.currentVideo.duration > 0 && time > 0) {
            pc = time / this.currentVideo.duration;
            pcSize = Math.ceil(size * pc);
            let bar = procgressChar.repeat(pcSize);
            str = c.yellow(`[${bar.padEnd(size)} ${numbro(pc).format({output: "percent", mantissa: 1})}]`);

        } else {
            pcSize = size;
        }



        return str;
    }

    title_truncate(str, leftSkipChars = 20) {

        if (kindOf(str) !== 'string') return "";

        str = str.replace(/[^\x00-\xFF]/g, "");


        let len = this.borderLine.length - leftSkipChars - 5;

        if (str.length > len) {
            str = str.slice(0, len) + '...'
        }


        return str;
    }



    spinner(idx = 1) {

        // https://www.alt-codes.net/
        this[`alt_${idx}`] = this[`alt_${idx}`] || 1;

        let arr;

        switch (idx) {
            case 1:
                arr = ['►', '>']
                break;
            case 2:
                // arr = ['Ò', 'Ó']
                arr = ['•', '○', '∙']
                break;

            default:
                break;
        }

        let str = arr[this[`alt_${idx}`] - 1]

        if (this[`alt_${idx}`] < arr.length) {
            this[`alt_${idx}`]++;
        } else {
            this[`alt_${idx}`] = 1;
        }

        return str;
    }

    log_art() {


        return new Promise((resolve, reject) => {
            figlet(' GeekPlay', function(err, data) {
                if (err) return reject(null)
                resolve(data)
            })
        });

    }

    format_line(str, rtl = true) {

        let len = stripAnsi(str).length;
        let m = stripAnsi(str).match(/./gu);
        if (m) len = m.length
            // len = splitter.countGraphemes(stripAnsi(str))
        let repeat = this.consoleRows - len - 1;

        // console.log(str, len, m, m.length);

        if (rtl) {
            str = `  ` + c.yellow(`┃ `) + str + ' '.repeat(repeat > 0 ? repeat : 0) + c.yellow(`┃`) + `\n`;
        } else {
            str = `  ` + c.yellow(`┃ `) + ' '.repeat(repeat > 0 ? repeat : 0) + str + c.yellow(`┃`) + `\n`;
        }


        return str
    }

    static_progressbar(pc, size = 20) {
        return `[${'>'.repeat(Math.ceil(size*pc)).padEnd(size)}]`
    }

    format_text(type, formatLine = true, rtl = true) {
        let str = '';


        // main header
        if (type == 'header') {
            str = `\n  Queued ` + c.bold(`${numbro(this.totalTracks).format({ average: true })} Tracks`) +

                (this.totalPlayTime ?
                    ` > ` + `Playtime: ` + c.bold(`${prettyMs(this.totalPlayTime, { verbose: true })}`) : ""
                );
        }
        // the track line
        else if (type == 'track-line') {
            str = c.bold(
                ` Track: ${this.trackNum}/${this.totalTracks} ` +
                (this.isPlaying ? c.red(`[${this.spinner()}]`) : '[■]') +
                ` ${this.title_truncate(this.currentVideo.title)}`
            )
        }
        // player stats
        else if (type == 'player-stats-line') {

            let volumePC = this.trackVolume / 100;
            str =
                // if shuffle is enabled
                c.gray(
                    (this.flags.shuffle ? "೩ shuffle on | " : "") +

                    'ᗧ' + '<'.repeat(Math.ceil(volumePC * 5)) + ' ' + numbro(volumePC).format({ output: 'percent' }) + ' | ' +

                    // total play time
                    `${prettyMs(this.totalPlayedTime,{ colonNotation: true })}  `
                )
        }
        // track stats
        else if (type == 'track-stats-line') {
            let timeDiff = this.currentVideo.duration ? (this.currentVideo.duration - this.trackTime) : this.trackTime;
            let formattedTime = prettyMs(timeDiff, { colonNotation: true }).split(':')
                .map(n => String(Math.round(n)).padStart(2, '0')).join(':');
            let views = numbro(this.currentVideo.views).format({ average: true, mantissa: this.currentVideo.views > 1000 ? 1 : 0 });

            str = (this.currentVideo.duration ?
                    ` ${this.progress_bar(this.trackTime)}` :
                    ` [` + 'x'.repeat(20) + `] |`) +
                ` ${formattedTime} |` +
                ` ${this.currentAudio.audioBitrate}kbps |` +
                ` ${bytes(Number(this.currentAudio.contentLength))}` +
                (this.currentVideo.views ? ` | ${views} YT Views` : '')
        }
        // show if track has been idle
        else if (type == 'idle-track-line') {
            c.red.italic(`> Track frozen for ${prettyMs(this.idlingTime)} ...could skip to next.  `)
        }
        // show next track
        else if (type == 'next-track') {
            let nextTrack = this.videos.length ? first(this.videos).title : null;
            // 
            str = c.gray.italic(
                `> Next: ` + this.title_truncate(nextTrack, 12) + '  ');

        }
        // show when loading next
        else if (type == 'loading-next-track') {
            str = c.italic(
                c.yellow(this.nextAudioLoading ? `   ${this.spinner(2)} Loading next track...  ` : "") +
                c.green(this.nextAudioReady ? `   ~ Next track ready ♪  ` : "")
            )
        }
        // separation gray line
        else if (type == 'gray-sep-line') {
            str = ` ` + c.gray(`-`.repeat(this.borderLine.length - 4))
        }
        // top borderline
        else if (type == 'borderline-top') {
            str = c.yellow(`  ┏` + this.borderLine + '┓');
        }
        //bottom border line
        else if (type == 'borderline-bottom') {
            str = c.yellow(`  ┗` + this.borderLine + `┛\n\n`)
        }

        // console.log({ str });
        if (formatLine) {
            str = this.format_line(str, rtl)
        }

        return str;
    }


}

class Player extends Loghelper {
    constructor(opts) {

        super()
        let self = this;

        this.consoleRows = 80;

        this.ffplayPath = config.get('ffplay-path');

        for (let k in opts) {
            self[k] = opts[k];
        }

    }

    current_video() {

        if (this.videos.length) {
            this.trackNum++;
            this.currentVideo = this.videos.shift();

            // console.log(this.currentVideo);
        }

    }

    async play(videos) {

        // filter out videos without a valid url
        videos = videos.filter(o => isUrl(o.url));

        let self = this;

        this.totalTracks = videos.length;
        this.trackNum = 0;
        this.totalPlayTime = videos.map(o => o.duration).reduce((a, b) => a + b, 0);
        this.totalPlayedTime = 0;

        //Do we want to shuffle videos
        if (this.flags.shuffle) {
            videos = shuffle(videos);
        }

        // set videos
        this.videos = videos;

        // start playlist...
        await this.run_playlist();

        let throttledTickerFunc = throttle(self.update_player.bind(self), 1000)

        function run_playlist() {
            self.run_playlist();
        }

        // 
        EE.on('file-playback-finished', run_playlist);
        EE.on('play-progress', function(time) {
            // update ticker with throttled...
            // logUpdate(time);
            throttledTickerFunc(time);
        });
        EE.on("finished-playback", function() {
            // exit procedures...
            // 1. Clear
            // clear();
            logUpdate.done();

        })
    }

    async update_player(time) {

        let self = this;
        this.trackTime = time;

        // first time, print header info
        if (!this.renderedPlayer) {

            // clear terminal
            // clear();

            this.borderLine = `━`.repeat(this.consoleRows);

            let pkgFile = path.join(__dirname, '../../package.json'),
                pkgData = require(pkgFile);

            console.log(
                `\n` +
                c.gray(await this.log_art() + c.italic(` version ${pkgData.version}`)) + `\n` +
                this.format_text('header', false) + '\n' +
                this.format_text('borderline-top', false)
            );
        }


        this.renderedPlayer = this.renderedPlayer || true;


        let content =
            // main player stats
            this.format_text('player-stats-line', true, false) +
            // sep
            this.format_text('gray-sep-line') +
            // the current track
            this.format_text('track-line') +
            // stats for the current line
            this.format_text('track-stats-line') +
            // shown if track has been idle for too long
            (this, this.idlingTime > this.settings.playback.timeout * .75 ? this.format_text('idle-track-line', true, false) : "") +
            // sep
            this.format_text('gray-sep-line') +
            // show next track if we have more than one track in playlist
            (this.videos.length > 1 ? this.format_text('next-track', true, false) : "") +
            // show next track loading info
            (this.nextAudioLoading || this.nextAudioReady ? this.format_text('loading-next-track', true, false) : "") +
            // blank spacing line
            this.format_line('') +
            // bottom border line
            this.format_text('borderline-bottom', false);

        logUpdate(content);


    }

    async run_playlist() {


        // if there still are files
        if (this.videos.length) {

            // pick video
            this.current_video();

            // get audio
            await this.get_audio()
                .catch(console.error)



            // play file...
            await this.play_audio();

        } else {
            EE.emit("finished-playback")
        }

    }

    async play_audio() {

        let self = this;

        if (this.currentAudio && !this.currentAudio.url) {
            // play next 
            EE.emit("finished-playback");
            return
        }

        this.nextAudioLoading = false;
        this.nextAudioReady = false;
        this.isPlaying = true;
        this.idlingTime = 0;
        this.trackPlayedTime = 0;

        this.trackVolume = dotProp.get(this, 'settings.playback.volume', 75);

        // console.log({ volume });

        let args = [
            '-vn',
            '-hide_banner',
            '-stats',
            '-nodisp',
            '-volume', this.trackVolume,
            '-infbuf',
            '-stats',
            '-autoexit',
            '-loglevel',
            'repeat+level+verbose',

            this.currentAudio.url
        ];


        // play...
        let child = execa(this.ffplayPath, args);


        clearInterval(this.idleTickerInterval)
        this.idleTickerInterval = setInterval(() => {
            this.idlingTime += 1000;
            this.trackPlayedTime += 1000;
            this.totalPlayedTime += 1000;

            if (this.idlingTime > this.settings.playback.timeout) {
                // End playback
                child.cancel()
            }
        }, 1000);



        child.stdout.on('data', (data) => {
            // console.log(data.toString());
        });

        let line, time, dataArr, matches;

        child.stderr.on('data', (data) => {

            this.idlingTime = 0;

            dataArr = data.toString().trim().split(/[\n\r]/);

            line = last(dataArr);
            if (dataArr.length > 1) {
                line = last(dataArr.slice(0, -1));
            }

            matches = line.match(/\[info\]\s+([0-9\.]+)\s+M-A/);


            if (matches) {
                time = matches[1];

                // console.log(time);

                let timeMS = duration_to_ms(time),
                    pc = timeMS / self.currentVideo.duration;

                EE.emit('play-progress', timeMS);

                // when we get to 80% percentage, 
                // start loading next audio to avoid play lag
                // because audio data is cached too, we don't need to load again when we get to track
                if (pc >= .8 && !self.nextAudioLoading) {
                    self.nextAudioLoading = true;

                    if (self.videos) {
                        self.get_audio(first(self.videos))
                    }


                }

            }

        })

        child.stderr.on('end', (data) => {
            this.isPlaying = false;
            // try play next ....
            EE.emit('file-playback-finished');
        })



    }

    async get_audio(currentVideo) {

        currentVideo = currentVideo || this.currentVideo;



        let cache = Cache('mp3'),
            results = cache.get('audio', currentVideo.url);


        if (!results) {
            // if we haven't rendered player
            if (!this.renderedPlayer) {
                console.log(truncate_to_window('>> ' + `Fetching audio results for ${this.currentVideo.title}`));
            }


            results = await ytdl.getInfo(currentVideo.url).catch(err => {
                console.log('>> ' + err);
                return null;
            });


            if (results) {
                // Set Audio formats as the expected results
                results = results.formats.map(o => o).filter(o => /^audio\//.test(o.mimeType));
                // Save audio
                cache.set('audio', currentVideo.url, results);
            }



        } else {
            // if we haven't rendered player
            if (!this.renderedPlayer) {
                console.log(truncate_to_window('>> ' + `Read cached audio results for ${this.currentVideo.title}`));
            }
        }

        if (results) {

            // sort by quality
            let sortedAudio = sortBy(results, ['audioBitrate'], ['asc']),
                highestQuality = sortedAudio.pop();

            this.currentAudio = highestQuality;

            this.nextAudioReady = true;
            this.nextAudioLoading = false;
        } else {
            // load next
            EE.emit('file-playback-finished');
        }

    }
}


module.exports = (opts) => new Player(opts)