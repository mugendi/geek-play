/*-------------------------------------------------------------------------------------------------------------------
    Modules
//-------------------------------------------------------------------------------------------------------------------*/
const ytdl = require('ytdl-core'),
    shuffle = require('lodash/shuffle'),
    sortBy = require('lodash/sortBy'),
    throttle = require("lodash/throttle"),
    first = require('lodash/first'),
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
    { duration_to_ms, stripAnsi } = require('../common');


/*-------------------------------------------------------------------------------------------------------------------
    Local
//-------------------------------------------------------------------------------------------------------------------*/

const Cache = require('../cache'),
    EE = new EventEmitter()


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

    format_line(str, rtl = true) {



        let len = stripAnsi(str).length,
            repeat = this.consoleRows - len - 1;

        if (rtl) {
            str = `  ` + c.yellow(`┃ `) + str + ' '.repeat(repeat > 0 ? repeat : 0) + c.yellow(`┃`) + `\n`;
        } else {
            str = `  ` + c.yellow(`┃ `) + ' '.repeat(repeat > 0 ? repeat : 0) + str + c.yellow(`┃`) + `\n`;
        }


        return str
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


}

class Player extends Loghelper {
    constructor(opts) {

        super()
        let self = this;

        this.consoleRows = 80;

        for (let k in opts) {
            self[k] = opts[k];
        }

    }

    current_video() {

        if (this.videos.length) {
            this.trackNum++;
            this.currentVideo = this.videos.shift();
        }

    }

    async play(videos) {

        // filter out videos without a valid url
        videos = videos.filter(o => isUrl(o.url));

        let self = this;

        this.totalTracks = videos.length;
        this.trackNum = 0;

        videos = videos.map(o => {
            o.duration = duration_to_ms(o.duration);
            return o
        })

        this.totalPlayTime = videos.map(o => o.duration).reduce((a, b) => a + b, 0);

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

        // first time, print header info
        if (!this.renderedPlayer) {

            // clear terminal
            clear();

            let headerLine = `\n  Queued ` + c.bold(`${numbro(this.totalTracks).format({ average: true })} Tracks`) +

                (this.totalPlayTime ?
                    ` > ` + `Playtime: ` + c.bold(`${prettyMs(this.totalPlayTime, { verbose: true })}`) : ""
                ),
                pkgFile = path.join(__dirname, '../../package.json'),
                pkgData = require(pkgFile);


            this.borderLine = `━`.repeat(this.consoleRows);


            console.log(
                // `\n━` + borderLine + `━\n` +
                `\n` +
                c.gray(await this.log_art() + c.italic(` version ${pkgData.version}`)) + `\n` +
                headerLine
            );
            console.log(c.yellow(`  ┏` + this.borderLine + '┓'));
        }



        this.renderedPlayer = this.renderedPlayer || true;


        let timeDiff = this.currentVideo.duration ? (this.currentVideo.duration - time) : time;
        let formattedTime = prettyMs(timeDiff, { colonNotation: true }).split(':')
            .map(n => String(Math.round(n)).padStart(2, '0')).join(':');


        // .slice(0, ).join(':')
        let nextTrack = this.videos.length ? first(this.videos).title : null;
        let views = numbro(this.currentVideo.views).format({ average: true, mantissa: this.currentVideo.views > 1000 ? 1 : 0 });


        let content =
            this.format_line('') +

            this.format_line(
                c.bold(
                    ` Track: ${this.trackNum}/${this.totalTracks} ` +
                    (this.isPlaying ? c.red(`[${this.spinner()}]`) : '[■]') +
                    ` ${this.title_truncate(this.currentVideo.title)}`
                )
            ) +

            this.format_line(
                (this.currentVideo.duration ?
                    ` ${this.progress_bar(time)}` :
                    ` [` + 'x'.repeat(20) + `] |`) +
                ` ${formattedTime} |` +
                ` ${this.currentAudio.audioBitrate}kbps |` +
                ` ${bytes(Number(this.currentAudio.contentLength))}` +
                (this.currentVideo.views ?
                    ` | ${views} YT Views` :
                    '')
            ) +



            (this, this.idlingTime > this.settings.playback.timeout * .75 ?
                this.format_line(c.red.italic(`> Track frozen for ${prettyMs(this.idlingTime)} ...could skip to next.  `), false) : "") +

            (this.videos.length ?

                this.format_line(` ` + c.gray(`-`.repeat(this.borderLine.length - 4))) +

                this.format_line(
                    c.gray.italic(
                        `> Next: ` + this.title_truncate(nextTrack, 12) + '  '
                    ), false
                ) +

                (this.nextAudioLoading || this.nextAudioReady ?
                    this.format_line(
                        c.italic(
                            c.yellow(this.nextAudioLoading ? `   ${this.spinner(2)} Loading next track...  ` : "") +
                            c.green(this.nextAudioReady ? `   ~ Next track ready ♪  ` : "")
                        ), false) : "")

                :
                ""
            ) +

            this.format_line('') +

            c.yellow(`  ┗` + this.borderLine + `┛\n\n`);

        // log the update

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

        let volume = dotProp.get(this.run_playlist, 'settings.playback.volume', 75);

        let args = [
            '-vn',
            '-hide_banner',
            '-stats',
            '-nodisp',
            '-volume', volume,
            '-infbuf',
            '-stats',
            '-autoexit',

            this.currentAudio.url
        ];

        // play...
        let child = execa('ffplay', args);


        clearInterval(this.idleTickerInterval)
        this.idleTickerInterval = setInterval(() => {
            this.idlingTime += 1000;

            if (this.idlingTime > this.settings.playback.timeout) {
                // End playback
                child.cancel()
            }
        }, 1000);



        child.stdout.on('data', (data) => {

        });

        let line, time;
        child.stderr.on('data', (data) => {
            line = data.toString().trim();

            this.idlingTime = 0;

            if (/^[0-9]+./.test(line)) {
                time = line.split(" ").shift()
            }


            if (time) {
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
                console.log('>> ' + `Fetching audio results for ${this.currentVideo.title}`);
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
                console.log('>> ' + `Read cached audio results for ${this.currentVideo.title}`);
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