/*-------------------------------------------------------------------------------------------------------------------
    Modules
//-------------------------------------------------------------------------------------------------------------------*/
const ytdl = require('ytdl-core'),
    shuffle = require('lodash/shuffle'),
    sortBy = require('lodash/sortBy'),
    throttle = require("lodash/throttle"),
    truncate = require('lodash/truncate'),
    first = require('lodash/first'),
    execa = require('execa'),
    EventEmitter = require('eventemitter3'),
    dotProp = require('dot-prop'),
    logUpdate = require('log-update'),
    prettyMs = require('pretty-ms'),
    numeral = require('numeral'),
    clear = require('clear'),
    c = require('ansi-colors'),
    bytes = require('bytes'),
    figlet = require('figlet'),
    path = require('path'),
    { duration_to_ms, stripAnsi } = require('../common');


/*-------------------------------------------------------------------------------------------------------------------
    Local
//-------------------------------------------------------------------------------------------------------------------*/

const Cache = require('../cache'),
    EE = new EventEmitter()


class Loghelper {

    progress_bar(time) {

        let procgressChar = '>',
            pc = time / this.currentVideo.duration,
            size = 20,
            pcSize = Math.ceil(size * pc),
            bar = procgressChar.repeat(pcSize)


        let str = `[${bar.padEnd(size)}]`

        return str;
    }

    title_truncate(str, leftSkipChars = 20) {
        // console.log({ leftSkipChars });
        str = truncate(str, {
            'length': (this.borderLine.length - leftSkipChars),
            'separator': /,? +/,
            'omission': ' ...'
        });

        return str;
    }

    format_line(str) {
        let len = stripAnsi(str).length,
            repeat = 70 - len - 1;
        return `  ` + c.yellow(`┃ `) + str + ' '.repeat(repeat > 0 ? repeat : 0) + c.yellow(`┃`) + `\n`
    }

    spinner(idx = 1) {

        // https://www.alt-codes.net/

        let arr;

        switch (idx) {
            case 1:
                arr = ['►', '>']
                break;
            case 2:
                arr = ['Ò', 'Ó']
                break;

            default:
                break;
        }

        let str = this[`alt_${idx}`] ? arr[0] : arr[1];

        this[`alt_${idx}`] = !this[`alt_${idx}`];

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
            clear();

        })
    }

    async update_player(time) {

        let self = this;


        // first time, print header info
        if (!this.renderedPlayer) {

            // console.log(this.currentVideo);
            // clear terminal
            clear();

            let headerLine = `\n  Queued ` + c.bold(`${numeral(this.totalTracks).format('0a')} Tracks`) + ` > ` +
                `Playtime: ` + c.bold(`${prettyMs(this.totalPlayTime, { verbose: true })}`),
                pkgFile = path.join(__dirname, '../../package.json'),
                pkgData = require(pkgFile);

            // console.log(stripAnsi(headerLine).length);
            this.borderLine = `━`.repeat(70);


            console.log(
                // `\n━` + borderLine + `━\n` +
                `\n` +
                c.gray(await this.log_art() + c.italic(` version ${pkgData.version}`)) + `\n` +
                headerLine
            );
            console.log(c.yellow(`  ┏` + this.borderLine + '┓'));
        }



        this.renderedPlayer = this.renderedPlayer || true;

        // console.log(time);
        let formattedTime = prettyMs((this.currentVideo.duration - time), { colonNotation: true }).split(':')
            .map(n => numeral(n).format('00')).join(':');

        // console.log(formattedTime);
        // .slice(0, ).join(':')
        let nextTrack = this.videos.length ? first(this.videos).title : null;
        let content =
            this.format_line('') +
            this.format_line(
                c.bold(
                    ` Track: ${this.trackNum}/${this.totalTracks} ` +
                    c.red(`[${this.spinner()}]`) +
                    ` ${this.title_truncate(this.currentVideo.title)}`
                )
            ) +

            this.format_line(
                ` ${this.progress_bar(time)}` +
                // ` ${this.spinner()} ` +
                ` ${formattedTime} |` +
                ` ${this.currentAudio.audioBitrate} kbps |` +
                ` ${bytes(Number(this.currentAudio.contentLength))} |` +
                ` ${numeral(this.currentVideo.views).format('0.0a')} YT Views`
            ) +

            this.format_line(` ` + c.gray(`-`.repeat(this.borderLine.length - 4))) +

            this.format_line(
                c.gray.italic(
                    ` Next Track: ` + this.title_truncate(nextTrack, 11) +
                    c.yellow(this.nextAudioLoading ? ` ~ ${this.spinner(2)} loading` : "") +
                    c.green(this.nextAudioReady ? ` ~ Ready` : "")
                )
            ) +

            this.format_line('') +

            c.yellow(`  ┗` + this.borderLine + `┛`);

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

            // console.log(this.trackNum);

            // play file...
            await this.play_audio();
            // console.log(this.currentAudio);
        } else {
            EE.emit("finished-playback")
        }

    }

    async play_audio() {

        let self = this;

        this.nextAudioLoading = false;
        this.nextAudioReady = false;

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
        let child = execa('ffplay', args)

        // console.log(stdout);
        child.stdout.on('data', (data) => {
            // console.log(`child stdout:\n${data}`);
        });

        let line, time;
        child.stderr.on('data', (data) => {
            line = data.toString().trim();

            if (/^[0-9]+./.test(line)) {
                time = line.split(" ").shift()
            }


            if (time) {
                let timeMS = duration_to_ms(time),
                    pc = timeMS / self.currentVideo.duration;

                EE.emit('play-progress', timeMS);

                // when we get to 90% percentage, 
                // start loading next audio to avoid play lag
                // because audio data is cached too, we don't need to load again when we get to track
                if (pc >= .90 && !self.nextAudioLoading) {
                    self.nextAudioLoading = true;

                    if (self.videos) {
                        self.get_audio(first(self.videos))
                    }


                }

            }

        })

        child.stderr.on('end', (data) => {
            // try play next ....
            EE.emit('file-playback-finished');
        })



    }

    async get_audio(currentVideo) {

        currentVideo = currentVideo || this.currentVideo;

        // console.log(currentVideo.title);

        let cache = Cache('mp3'),
            results = cache.get('audio', currentVideo.url);


        if (!results) {
            // if we haven't rendered player
            if (!this.renderedPlayer) {
                console.log(`Fetching audio results for ${this.currentVideo.title}`);
            }

            // console.log(this.currentVideo);
            results = await ytdl.getInfo(currentVideo.url).catch(err => {
                console.log(err);
                return null;
            });

            // Set Audio formats as the expected results
            results = results.formats.map(o => o).filter(o => /^audio\//.test(o.mimeType));

            // Save audio
            cache.set('audio', currentVideo.url, results);

        } else {
            // if we haven't rendered player
            if (!this.renderedPlayer) {
                console.log(`Read cached audio results for ${this.currentVideo.title}`);
            }
        }


        // sort by quality
        let sortedAudio = sortBy(results, ['audioBitrate'], ['asc']),
            highestQuality = sortedAudio.pop();

        this.currentAudio = highestQuality;

        this.nextAudioReady = true;
        this.nextAudioLoading = false;

    }
}


module.exports = (opts) => new Player(opts)