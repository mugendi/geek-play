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



/*-------------------------------------------------------------------------------------------------------------------
    Log Helper
//-------------------------------------------------------------------------------------------------------------------*/

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

    title_truncate(str) {
        str = truncate(str, {
            'length': this.borderLine.length - 15,
            'separator': /,? +/,
            'omission': ' ...'
        });

        return str;
    }

    format_line(str) {
        let len = stripAnsi(str).length;
        return c.yellow(`┃ `) + str + ' '.repeat(this.borderLine.length - len - 1) + c.yellow(`┃`) + `\n`
    }

    log_art() {


        return new Promise((resolve, reject) => {
            figlet('   GeekPlay', function(err, data) {
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

        videos = videos.slice(0, 5)

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
            throttledTickerFunc(time);
        });
        EE.on("finished-playback", function() {
            // exit procedures...

        })
    }

    async update_player(time) {

        let self = this;


        // first time, print header info
        if (!this.painted) {

            // clear terminal
            clear();

            let headerLine = `\n  Queued ${this.totalTracks} Tracks | ` +
                `Total Playtime: ${prettyMs(this.totalPlayTime, { verbose: true })}`,
                pkgFile = path.join(__dirname, '../../package.json'),
                pkgData = require(pkgFile);

            this.borderLine = `━`.repeat(headerLine.length);


            console.log(
                // `\n━` + borderLine + `━\n` +
                `\n` +
                c.gray(await this.log_art() + c.italic(` version ${pkgData.version}`)) + `\n` +
                headerLine
            );
            console.log(c.yellow(`┏` + this.borderLine + '┓'));
        }



        this.painted = this.painted || true;

        // console.log(time);
        let formattedTime = prettyMs((this.currentVideo.duration - time), { colonNotation: true }).split(':')
            .map(n => numeral(n).format('00')).join(':');

        // console.log(formattedTime);
        // .slice(0, ).join(':')
        let nextTrack = this.videos.length ? first(this.videos).title : null;
        let content =
            this.format_line(`Track: ${this.trackNum}/${this.totalTracks} ` + c.bold.red(`[>]`) + ` ${this.title_truncate(this.currentVideo.title)}`) +
            this.format_line(` ${this.progress_bar(time)}  ${formattedTime} | ${this.currentAudio.audioBitrate} kbps | ${bytes(Number(this.currentAudio.contentLength))}`) +
            this.format_line(` ` + c.gray(`-`.repeat(this.borderLine.length - 4))) +
            this.format_line(c.gray.italic(` Next Track: ` + this.title_truncate(nextTrack))) +
            c.yellow(`┗` + this.borderLine + `┛`);

        // log the update
        logUpdate(content);


    }

    async run_playlist() {


        // if there still are files
        if (this.videos.length) {

            // pick video
            this.current_video();

            // get audio
            await this.get_audio();

            // console.log(this.trackNum);

            // play file...
            await this.play_audio();
            // console.log(this.currentAudio);
        } else {
            EE.emit("finished-playback")
        }

    }

    async play_audio() {

        let volume = dotProp.get(this.run_playlist, 'settings.playback.volume', 75)

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
                EE.emit('play-progress', duration_to_ms(time));
            }

        })

        child.stderr.on('end', (data) => {
            // try play next ....
            EE.emit('file-playback-finished');
        })

        // setTimeout(() => {
        //     child.cancel();

        //     // 
        // }, 5000);

    }

    async get_audio() {

        let cache = Cache('mp3'),
            results = cache.get('audio', this.currentVideo.url);


        if (!results) {
            // console.log(`Fetching audio results for ${this.currentVideo.title}`);
            // console.log(this.currentVideo);
            results = await ytdl.getInfo(this.currentVideo.url).catch(err => {
                console.log(err);
                return null;
            });

            let audioFormats = results.formats.map(o => o).filter(o => /^audio\//.test(o.mimeType));

            cache.set('audio', this.currentVideo.url, audioFormats);
        } else {
            // console.log(`Read cached audio results for ${this.currentVideo.title}`);
        }


        // sort by quality
        let sortedAudio = sortBy(results, ['audioBitrate'], ['asc']),
            highestQuality = sortedAudio.pop();

        this.currentAudio = highestQuality;

    }
}


module.exports = (opts) => new Player(opts)