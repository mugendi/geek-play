// const wtfnode = require('wtfnode');

/*-------------------------------------------------------------------------------------------------------------------
    Modules
//-------------------------------------------------------------------------------------------------------------------*/
const { isNumber } = require('lodash');
const shuffle = require('lodash/shuffle'),
    sortBy = require('lodash/sortBy'),
    throttle = require("lodash/throttle"),
    first = require('lodash/first'),
    find = require('lodash/find'),
    last = require('lodash/last'),
    pick = require('lodash/pick'),
    size = require('lodash/size'),
    execa = require('execa'),

    dotProp = require('dot-prop'),
    logUpdate = require('log-update'),
    pretty_MS = require('pretty-ms'),
    numbro = require('numbro'),
    clear = require('clear'),
    kleur = require('kleur'),
    bytes = require('bytes'),
    figlet = require('figlet'),
    isUrl = require('is-url'),
    path = require('path'),
    kindOf = require('kind-of'),
    got = require('got'),
    cheerio = require('cheerio'),
    Conf = require('conf'),
    arrify = require('arrify'),
    isOnline = require('is-online'),
    beeper = require('beeper'),
    delay = require('delay'),
    { bind } = require('process-suspend'),

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
    ytdl = require('../platforms/youtube/ytdl-core'),

    config = new Conf(),
    keypress = require('../keypress'),
    playCache = new Conf('geek-play-cache'),
    ProgressBar = require("../progress-bar"),
    Windows = require('../windows'),
    progressBar = new ProgressBar();


// handle both finite and none finite
function prettyMs(n, opts) {
    n = isNumber(n) && isFinite(n) ? n : 0;
    // console.log({ n }, pretty_MS(n));
    return pretty_MS(n, opts)
}

class Loghelper {

    progress_bar(time) {


        let
            bar, pcSize,
            progressChar = '■',
            str = '',
            pc = 0,
            size = Math.ceil(this.consoleRows / 4.5);

        if (this.currentSource.duration > 0 && time > 0) {
            pc = time / this.currentSource.duration;

            // never display beyond 100pc
            if (pc > 1) pc = 1;
        }

        pcSize = Math.floor(size * pc);
        bar = progressChar.repeat(pcSize);
        str = kleur.yellow(`[${bar.padEnd(size)} ${numbro(pc).format({output: "percent", mantissa: 0})}]`);

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
            str = `  ` + kleur.yellow(`┃ `) + str + ' '.repeat(repeat > 0 ? repeat : 0) + kleur.yellow(`┃`) + `\n`;
        } else {
            str = `  ` + kleur.yellow(`┃ `) + ' '.repeat(repeat > 0 ? repeat : 0) + str + kleur.yellow(`┃`) + `\n`;
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
            str = `\n  Queued ` + kleur.bold(`${numbro(this.totalTracks).format({ average: true })} Tracks`) +

                (this.totalPlayTime ?
                    ` > ` + `Playtime: ` + kleur.bold(`${prettyMs(this.totalPlayTime, { verbose: true })}`) : ""
                );
        }
        // the track line
        else if (type == 'track-line') {
            str = kleur.bold(
                ` Track: ${this.trackNum}/${this.totalTracks} ` +
                (this.isPlaying ? kleur.red(`[${this.spinner()}]`) : '[■]') +
                ` ${this.title_truncate(this.currentSource.title)}`
            )
        }
        // player stats
        else if (type == 'player-stats-line') {
            let volumePC = this.trackVolume / 100,
                volBars = 10;

            str =
                // if shuffle is enabled
                kleur.gray(
                    (this.altAudio ? 'ALT AUDIO ¤ | ' : '') +
                    // Volume 
                    ('VOL ͽ' + ')'.repeat(Math.ceil(volumePC * volBars))) + ' | ' +
                    // Shuffled?
                    (this.flags.shuffle ? "SHUFFLED Ջ | " : "") +
                    // Loop Enabled?
                    (this.flags.loop ? "LOOPED Ҩ | " : "") +
                    // total play time
                    `PLAYTIME: ${prettyMs(this.totalPlayedTime + this.trackTime,{ colonNotation: true }).replace(/\..+/,'')}  `
                )
        }
        // track stats
        else if (type == 'track-stats-line') {

            let timeDiff = this.currentSource.duration ? (this.currentSource.duration - this.trackTime) : this.trackTime;

            let formattedTime = prettyMs(timeDiff, { colonNotation: true }).split(':')
                .map(n => String(Math.round(n)).padStart(2, '0')).join(':');

            let views = numbro(this.currentSource.views).format({ average: true, mantissa: this.currentSource.views > 1000 ? 1 : 0 }),
                audioBitrate = dotProp.get(this, 'currentAudio.audioBitrate', null)

            str = (this.currentSource.duration ?
                    ` ${this.progress_bar(this.trackTime)}` :
                    ` [` + 'x'.repeat(20) + `] |`) +
                ` ${formattedTime} |` +
                (audioBitrate ? audioBitrate + 'kbps |' : '') +
                ` ${bytes(Number(this.currentAudio.contentLength))}` +
                (this.currentSource.views ? ` | ${views} YT Views` : '')
        }
        // show if track has been idle
        else if (type == 'idle-track-line') {
            str = kleur.red().italic(`> Track frozen for ${prettyMs(this.idlingTime)} ...could skip to next.  `)
        }
        // show next track
        else if (type == 'next-track') {
            str = kleur.gray().italic(`> Next: ` + this.title_truncate((this.sources[this.trackNum] || this.sources[0]).title, 12) + '  ');

        }
        // show when loading next
        else if (type == 'loading-next-track') {
            str = kleur.italic(
                kleur.yellow(this.nextAudioLoading ? `   ${this.spinner(2)} Loading next track...  ` : "") +
                kleur.green(this.nextAudioReady ? `   ~ Next track ready ♪  ` : "")
            )
        }
        // separation gray line
        else if (type == 'gray-sep-line') {
            str = ` ` + kleur.gray(`-`.repeat(this.borderLine.length - 4))
        }

        // error status
        else if (type == 'error-status') {
            str = kleur.red().bold(`${this.playerError.message}!  `)
        }

        // top borderline
        else if (type == 'borderline-top') {
            str = kleur.yellow(`  ┏` + this.borderLine + '┓');
        }
        //bottom border line
        else if (type == 'borderline-bottom') {
            str = kleur.yellow(`  ┗` + this.borderLine + `┛\n`)
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

        for (let k in opts) {
            self[k] = opts[k];
        }


        this.consoleRows = 80;

        this.ffplayPath = config.get('ffplay-path');



        this.hotKeys = [{
                name: 'c',
                ctrl: true,
                meta: false,
                shift: false,
                action: 'finished-playback',
                message: "Playback Stopped"
            }, {
                name: 'right',
                ctrl: false,
                meta: false,
                shift: false,
                action: 'play-next-track',
                message: "Next Track"
            }, {
                name: 'left',
                ctrl: false,
                meta: false,
                shift: false,
                action: 'play-previous-track',
                message: "Previous Track"
            }, {
                name: 'space',
                ctrl: false,
                meta: false,
                shift: false,
                action: 'play-pause',
                message: 'Play/Pause'
            },
            {
                name: 's',
                ctrl: false,
                meta: false,
                shift: false,
                action: 'window-settings',
                message: 'Show Settings'
            },
            {
                name: 'p',
                ctrl: false,
                meta: false,
                shift: false,
                action: 'window-playlist',
                message: 'Show Playlist'
            }
        ]


        this.windows = Windows(this);

        // this.mutePlayerLog = true;
        self.key_events();


    }

    async key_events() {

        let self = this;
        let keyEvent;

        let events = function(a, b, c) {
            // console.log({ a, b });

            if (a == '\x03') {
                self.closePlayer()
            }

            keyEvent = find(self.hotKeys, pick(b, 'name', 'ctrl', 'shift', 'meta'));
            if (keyEvent) {
                // console.log(keyEvent);
                self.interruptMessage = keyEvent.message;
                this.EE.emit(keyEvent.action)
            }
        }

        this.keyListenerOff = keypress.listen({ stdin: process.stdin }, events);

    }

    async listen_for_events() {
        let self = this;

        let throttledTickerFunc = throttle(self.update_player.bind(self), 1000);

        function run_playlist() {
            this.run_playlist();
        }

        function play_pause() {
            if (this.isPlaying) {
                self.belowWindowMsg = "Playback paused...";
                this.currentFfplayProcess.suspend();
                this.isPlaying = false;
            } else {
                self.belowWindowMsg = "Restarting playback...";
                this.currentFfplayProcess.resume();
                this.isPlaying = true;
            }
            this.update_player()
        }

        function next_track() {
            // check if we can step back...
            if (this.isPlaying)
                self.run_playlist();
        }

        function prev_track() {
            // check if we can step back...
            if (this.trackNum > 1 && this.isPlaying) {
                this.trackNum = this.trackNum - 2;
                self.run_playlist();
            }
        }


        // event listeners
        function showWindow(w) {
            if (!self.offPlayerWindow && this.renderedPlayer)
                self.showWindow(w);
        }

        this.EE.on('window-settings', showWindow.bind(this, 'settings'));
        this.EE.on('window-playlist', showWindow.bind(this, 'playlist'));

        this.EE.on('play-pause', play_pause, this)
        this.EE.on('play-next-track', run_playlist, this);
        this.EE.on('play-previous-track', prev_track, this);
        this.EE.on('update_player', self.update_player, this)
        this.EE.on('play-progress', function(time) {
            // update ticker with throttled...
            // logUpdate(time);
            throttledTickerFunc(time);
        });
        this.EE.on("finished-playback", async function() {
            self.closePlayer();
        })
    }


    async closePlayer() {
        let self = this;
        self.playerStopped = true;

        process.stdin.end();
        // exit procedures...
        // close process
        await self.end_ffplay(true);

        // end timer
        clearInterval(self.idleTickerInterval);

        // remove listeners
        await this.EE.removeAllListeners();

        await new Promise((resolve, reject) => {
            setTimeout(() => {
                // persist player
                logUpdate.done();
                // if we have an error status, probably why we ended?
                if (this.errorStatus) {
                    console.log(`>> Playback ended likely because of this error: ${kleur.red().bold(this.errorStatus)}`);
                }
                resolve();
            }, 500);
        });

        console.log('>> Closing player... Adios!\n');

        process.exit(0)
    }

    showWindow(window) {

        let self = this;
        // const clearModule = require('clear-module');
        // let Windows = require('../windows');
        // clearModule('../windows');
        // this.windows = Windows(this);


        // show window
        if (this.windows[window] && this.offPlayerWindow === false) {

            // remove key listeners so that the new window can register it's own
            this.keyListenerOff();

            //stop player logs
            this.mutePlayerLog = true;
            // clear log
            logUpdate.clear();


            this.offPlayerWindow = true;

            this.windows[window]()
                .then((resp) => {

                    self.belowWindowMsg = resp;
                    this.renderedPlayer = false;
                    this.mutePlayerLog = false;

                    // reset player key listeners  
                    self.key_events();

                })
                .catch(console.error)
        }
    }

    current_source() {

        this.trackNum = kindOf(this.trackNum) == 'undefined' ? 0 : this.trackNum;

        // if loop is enabled, then we go back to zero
        // console.log(this.flags);
        // if (this.flags.loop)

        if (this.trackNum < this.sources.length) {
            this.currentSource = this.sources[this.trackNum];
            this.trackNum++;
            return true;
        } else {

            if (this.flags.loop) {
                this.trackNum = 0;
                return true;
            } else {
                return false;
            }

        }

    }

    async get_audio(currentSource) {

        currentSource = currentSource || this.currentSource;

        this.altAudio = false;

        // Only attempt to get audio for video files
        // if (currentSource.type !== 'video') return;

        let cache = Cache('mp3');
        // cache.del('audio', currentSource.url);
        let results = cache.get('audio', currentSource.url);


        if (!results) {
            // if we haven't rendered player
            if (!this.renderedPlayer) {
                console.log(truncate_to_window('>> ' + `Fetching audio results for ${currentSource.title}`));
            }


            results = await ytdl.getInfo(currentSource.url).catch(err => {
                if (!this.renderedPlayer)
                    console.log('>> ' + err);
                return null;
            });


            if (results) {
                // Set Audio formats as the expected results
                results = results.formats.map(o => o).filter(o => /^audio\//.test(o.mimeType));
                // Save audio
                cache.set('audio', currentSource.url, results);
            }



        } else {
            // if we haven't rendered player
            if (!this.renderedPlayer) {
                console.log(truncate_to_window('>> ' + `Read cached audio results for ${currentSource.title}`));
            }
        }

        if (results) {

            // sort by quality
            this.sortedAudioAlternatives = sortBy(results, ['audioBitrate'], ['asc']);

            let highestQuality = this.sortedAudioAlternatives.pop();

            this.currentAudio = highestQuality;

            this.nextAudioReady = true;
            this.nextAudioLoading = false;

        } else {
            // load next
            this.EE.emit('play-next-track');
        }

    }

    async audio_fallback() {
        if (this.playerStopped) return;

        this.attemptingAudioFallback = true;

        // if (this.sortedAudioAlternatives.length) {
        //     this.currentAudio = this.sortedAudioAlternatives.pop();
        //     await this.play_audio();
        //     return;
        // }

        let url = 'https://www.yt-download.org/api/button/mp3/' + this.currentSource.id;

        let body = await got(url).then(resp => resp.body),
            $ = cheerio.load(body),
            links = $('.download  a').map(function() {
                return $(this).attr('href')
            }).get(),
            link = first(links)

        this.altAudio = true;
        this.currentAudio.url = link;
        // console.log({ link });
        // attempt to play file again
        await this.play_audio();

    }


    playNext() {
        this.EE.emit('play-next-track')
    }

    playPrev() {
        this.EE.emit('play-previous-track')
    }


    setError(code) {
        let errors = {
            601: "No Internet Access",
            602: 'Playback paused till Internet resumes...'
        }

        this.playerError = { message: errors[code], code };

        this.EE.emit('update_player');
    }

    isError(code) {
        return (this.playerError && this.playerError.code == code)
    }

    hasError() {
        return (this.playerError && this.playerError.code)
    }

    clearError() {
        this.playerError = {};
    }



    async play(sources) {

        // this.mutePlayerLog = true

        // filter out sources without a valid url
        sources = sources.filter(o => isUrl(o.url));
        console.log(sources.length);

        let self = this;

        this.totalTracks = sources.length;
        this.trackNum = 0;
        this.totalPlayTime = sources.map(o => o.duration).reduce((a, b) => a + b, 0);
        this.totalPlayedTime = 0;
        this.playerError = {}

        // playCache.delete('playSession');
        let blankSession = { played: [], currentTrackNum: 0, name: this.input };
        this.playSession = playCache.get('playSession') || blankSession;

        // ensure session is similar to this one.
        if (this.playSession.name !== this.input) {
            playCache.delete('playSession');
            this.playSession = blankSession;
        }
        // continueLastSession enabled
        else if (this.settings.playback.continueLastSession == 'yes') {
            // console.log(this.playSession.played);
            let playedSources = arrify(this.playSession.played);
            // filter out played sources
            sources = sources.filter(o => playedSources.indexOf(o.url) == -1);
        } else {
            // no need for session...
            playCache.delete('playSession');
        }

        //Do we want to shuffle sources
        if (this.flags.shuffle) {
            sources = shuffle(sources);
        }

        // set sources
        this.sources = sources;



        // start playlist...
        await this.run_playlist();

        // listen for events
        this.listen_for_events();


    }

    async update_player(time) {

        let self = this;
        this.trackTime = time;

        // first time, print header info
        if (!this.renderedPlayer) {

            // clear terminal
            if (!this.mutePlayerLog) {
                clear();
            }


            this.borderLine = `━`.repeat(this.consoleRows);

            let pkgFile = path.join(__dirname, '../../package.json'),
                pkgData = require(pkgFile);

            if (!this.mutePlayerLog) {
                console.log(
                    `\n` +
                    kleur.gray(await this.log_art() + kleur.italic(` version ${pkgData.version}`)) + `\n` +
                    this.format_text('header', false)
                );
            }
        }


        this.renderedPlayer = this.renderedPlayer || true;


        // delay a little to show any final messages
        if (self.belowWindowMsg) {
            setTimeout(() => {
                self.belowWindowMsg = null;
            }, 5000);
        }



        let content = '\n' +
            this.format_text('borderline-top', false) + '\n' +
            // main player stats
            this.format_text('player-stats-line', true, false) +
            // sep
            this.format_text('gray-sep-line') +
            // the current track
            this.format_text('track-line') +
            // stats for the current line
            this.format_text('track-stats-line') +
            // shown if track has been idle for too long
            (this.idlingTime > this.settings.playback.timeout * .75 &&
                !self.isError(602) ?
                this.format_text('idle-track-line', true, false) : ""
            ) +
            // sep
            this.format_text('gray-sep-line') +
            // show next track if we have more than one track in playlist
            (this.trackNum < this.sources.length || this.flags.loop ? this.format_text('next-track', true, false) : "") +
            // show next track loading info
            (this.nextAudioLoading || this.nextAudioReady ? this.format_text('loading-next-track', true, false) : "") +
            // blank spacing line
            (this.playerError.code ? this.format_text('error-status', true, false) : '') +
            // bottom border line
            this.format_text('borderline-bottom', false) +
            ((self.belowWindowMsg) ? kleur.gray().italic("  >> " + self.belowWindowMsg.replace(/[\n\r]/g, '')) + '\n' : "");

        if (!this.mutePlayerLog) {
            logUpdate(content);
        }

        this.offPlayerWindow = false;

    }

    async run_playlist() {


        if (this.playerStopped) return;
        // if (this.renderedPlayer && !this.isPlaying) return;

        this.isPlaying = false;


        // pick source
        let hasCurrentSource = this.current_source();

        if (hasCurrentSource) {

            // if source is a video
            if (this.currentSource.type == 'video') {
                // get audio
                await this.get_audio().catch(console.error);
            }

            // play file...
            this.play_audio();

        } else {
            this.playNext()
        }



    }

    async end_ffplay() {

        // otherwise end all others
        for (let i in this.ffplayProcesses) {
            // kill
            this.ffplayProcesses[i].child.kill();
            //delete
            delete this.ffplayProcesses[i];
        }

    }


    async play_audio(startSeek = 0) {
        let self = this;

        // this.mutePlayerLog = true;

        if (this.playerStopped) return;


        if (!this.currentAudio || !this.currentAudio.url) {
            // play next 
            this.playNext()
            return
        }

        this.nextAudioLoading = false;
        this.nextAudioReady = false;
        this.isPlaying = false;
        this.idlingTime = 0;
        this.trackPlayedTime = 0;
        this.trackVolume = dotProp.get(this, 'settings.playback.volume', 75);
        this.attemptingAudioFallback = false;
        this.isOnline = false;
        this.hasBeeped = false;
        self.interruptMessage = null;

        this.ffplayProcesses = this.ffplayProcesses || {};

        this.trackLastPlayedTime = this.trackLastPlayedTime || 0;

        // end all others...
        this.end_ffplay()

        let args = [
            '-vn',
            '-hide_banner',
            '-stats',
            '-nodisp',
            '-volume', this.trackVolume,
            '-infbuf',
            '-autoexit',
            '-loglevel',
            'repeat+level+verbose',
            '-ss',
            // skip to time....
            Math.ceil(startSeek),
            // play path or audio
            this.currentAudio.path || this.currentAudio.url
        ];

        if (!this.ffplayPath) {
            // error!
        }

        let ffplaySubProcess = execa(this.ffplayPath, args);

        bind(ffplaySubProcess);

        // child.stdin.write("console.log('Hello from PhantomJS')\n");
        // this.mutePlayerLog = true;
        this.currentFfplayProcess = ffplaySubProcess;

        // play...
        this.ffplayProcesses[size(this.ffplayProcesses)] = {
            track: this.currentAudio.url,
            child: ffplaySubProcess
        }


        clearInterval(this.idleTickerInterval);

        this.idleTickerInterval = setInterval(() => {

            // this.totalPlayedTime += 1000;
            // if player is not suspended
            if (!this.currentFfplayProcess.isSuspended && !self.hasError()) {
                // increment idling time
                this.idlingTime += 1000;

                // playing, increment time
                if (self.isPlaying) {
                    this.trackPlayedTime += 1000;
                }

                // If track freezes for too long...
                if (this.idlingTime > this.settings.playback.timeout) {
                    // Go to next track
                    this.playNext()
                }
            }

            // console.log(self.isPlaying, self.isError(601), this.playerError, Math.random(), this.currentFfplayProcess.isSuspended);
            if (!self.isPlaying && self.isError(601)) {
                // escalate the error
                self.setError(602);
                // pause player
                self.currentFfplayProcess.suspend()
            }

            // toggle no internet error beeper
            if (!this.hasBeeped && self.isError(601)) {
                beeper('**');
                this.hasBeeped = true;
            }

            if (this.hasBeeped && !self.isError(601)) {
                this.hasBeeped = false;
            }

            // continually check internet connection
            isOnline()
                .then((status) => {
                    if (status == false) {
                        this.isOnline = false;

                        // set error 601 if we already aren't past that
                        if (!self.isError(602)) {
                            self.setError(601);
                        }

                    } else {

                        // if player was paused and internet is back
                        // console.log(this.currentFfplayProcess.isSuspended);
                        if (self.hasError() && self.currentFfplayProcess.isSuspended) {
                            // oh we are resuming from a pause....let's ask to continue playback
                            // clear errors
                            self.clearError();
                            // resume playback
                            self.currentFfplayProcess.resume()
                        }

                        this.isOnline = true;

                    }
                })
                .catch(console.error)
        }, 1000);



        ffplaySubProcess.stdout.on('data', (data) => {
            // console.log(data.toString());
        });

        let line, time, dataArr, matches;

        ffplaySubProcess.stderr.on('data', async(data) => {

            // stringify
            data = data.toString().trim();

            let msgType = (data.match(/\[(.+?)\]\s/) || [null, null])[1],
                httpError = (data.match(/\[warning\]\s+HTTP\s+error/) ? true : false);


            // If HTTPS Error
            if (msgType !== 'info' && httpError) {
                // console.log(data);
                // do not try a fallback when the fallback also fails
                if (this.currentAudio.url.indexOf('yt-download.org') == -1) {
                    if (!this.renderedPlayer)
                        console.log(kleur.gray(`  - Initial audio couldn't play. Attempting another...`));
                    await this.audio_fallback();
                } else {
                    if (!this.renderedPlayer)
                        console.log(kleur.red(`  - Completely unable to play audio for this track. Sorry.`));
                }


            } else if (msgType == 'info') {

                dataArr = data.split(/[\n\r]/);

                line = last(dataArr);
                if (dataArr.length > 1) {
                    line = last(dataArr.slice(0, -1));
                }

                matches = line.match(/\[info\]\s+([0-9\.]+)\s+M-A/);


                if (matches) {
                    time = matches[1];

                    matches = (line.match(/aq=\s+([0-9]+)[KM]B/) || [null, 0]);

                    // get data acquired
                    let dataAq = Number(matches[1]);

                    // if we have any data
                    if (dataAq) {

                        // reset idlying time...
                        self.idlingTime = 0;

                        // 
                        if (!self.isPlaying) {
                            setTimeout(() => {
                                // setTimeout
                                self.isPlaying = true;
                            }, 1000);
                        }

                        // convert ffplay time to ms & emit
                        let timeMS = duration_to_ms(time),
                            pc = timeMS / self.currentSource.duration;

                        this.trackLastPlayedTime = timeMS;

                        this.EE.emit('play-progress', timeMS);

                        // when we get to 80% percentage, 
                        // start loading next audio to avoid play lag
                        // because audio data is cached too, we don't need to load again when we get to track
                        if (pc >= .8) {

                            // if no other track is loading, if we havent loaded any other track, and are online
                            if (!self.nextAudioLoading && !this.nextAudioReady && this.isOnline) {

                                if (this.trackNum < this.sources.length && this.currentSource.type == 'video') {
                                    self.nextAudioLoading = true;
                                    self.get_audio(this.sources[this.trackNum]);
                                }
                            }

                            // this.end_ffplay();
                        }

                    } else {
                        // do data so we cant still be playing
                        self.isPlaying = false;
                    }
                }
            }
        })

        // when we get to the end...
        ffplaySubProcess.stderr.on('end', (data) => {
            // set playing to false
            self.isPlaying = false;
            // commit track time
            this.totalPlayedTime += this.trackLastPlayedTime


            // if online && not attempting audio fallback and no errors exist
            if (this.isOnline && !self.attemptingAudioFallback && !self.errorStatus) {


                // console.log(this.interruptMessage);
                // console.log(this.playSession);

                if (!this.interruptMessage) {
                    // do we need to save this session?
                    if (this.settings.playback.continueLastSession == 'yes') {
                        // record played track on play session
                        // keep data sizeable
                        this.playSession.played = this.playSession.played.slice(-500);
                        // add new item
                        this.playSession.played.push(this.currentSource.url);
                        // mark current
                        this.playSession.currentTrackNum = this.trackNum - 1;

                        playCache.set('playSession', this.playSession)
                    }


                    // try play next ....
                    this.playNext()
                }


            }
        })



    }


}


module.exports = (opts) => new Player(opts)