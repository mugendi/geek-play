// const wtfnode = require('wtfnode');

/*-------------------------------------------------------------------------------------------------------------------
    Modules
//-------------------------------------------------------------------------------------------------------------------*/
const { isNumber } = require('lodash');
const ytdl = require('ytdl-core'),
    shuffle = require('lodash/shuffle'),
    sortBy = require('lodash/sortBy'),
    throttle = require("lodash/throttle"),
    first = require('lodash/first'),
    find = require('lodash/find'),
    last = require('lodash/last'),
    pick = require('lodash/pick'),
    size = require('lodash/size'),
    execa = require('execa'),
    EventEmitter = require('eventemitter3'),
    dotProp = require('dot-prop'),
    logUpdate = require('log-update'),
    pretty_MS = require('pretty-ms'),
    numbro = require('numbro'),
    clear = require('clear'),
    c = require('ansi-colors'),
    bytes = require('bytes'),
    figlet = require('figlet'),
    isUrl = require('is-url'),
    path = require('path'),
    kindOf = require('kind-of'),
    miniget = require('miniget'),
    cheerio = require('cheerio'),
    Conf = require('conf'),
    arrify = require('arrify'),
    isOnline = require('is-online'),
    beeper = require('beeper'),

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
    keypress = require('../keypress'),
    playCache = new Conf('geek-play-cache'),
    ProgressBar = require("../progress-bar"),
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

        if (this.currentVideo.duration > 0 && time > 0) {
            pc = time / this.currentVideo.duration;

            // never display beyond 100pc
            if (pc > 1) pc = 1;
        }

        pcSize = Math.floor(size * pc);
        bar = progressChar.repeat(pcSize);
        str = c.yellow(`[${bar.padEnd(size)} ${numbro(pc).format({output: "percent", mantissa: 0})}]`);

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
            let volumePC = this.trackVolume / 100,
                volBars = 10;

            str =
                // if shuffle is enabled
                c.gray(
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
            str = c.red.italic(`> Track frozen for ${prettyMs(this.idlingTime)} ...could skip to next.  `)
        }
        // show next track
        else if (type == 'next-track') {
            str = c.gray.italic(`> Next: ` + this.title_truncate((this.videos[this.trackNum] || this.videos[0]).title, 12) + '  ');

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

        // error status
        else if (type == 'error-status') {
            str = c.red.bold(`${this.errorStatus}!  `)
        }

        // top borderline
        else if (type == 'borderline-top') {
            str = c.yellow(`  ┏` + this.borderLine + '┓');
        }
        //bottom border line
        else if (type == 'borderline-bottom') {
            str = c.yellow(`  ┗` + this.borderLine + `┛\n`)
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
        }]

        for (let k in opts) {
            self[k] = opts[k];
        }

    }

    current_video() {

        this.trackNum = kindOf(this.trackNum) == 'undefined' ? 0 : this.trackNum;

        // if loop is enabled, then we go back to zero
        // console.log(this.flags);
        // if (this.flags.loop)

        if (this.trackNum < this.videos.length) {
            this.currentVideo = this.videos[this.trackNum];
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

    async get_audio(currentVideo) {

        currentVideo = currentVideo || this.currentVideo;

        let cache = Cache('mp3'),
            results = cache.get('audio', currentVideo.url);


        if (!results) {
            // if we haven't rendered player
            if (!this.renderedPlayer) {
                console.log(truncate_to_window('>> ' + `Fetching audio results for ${currentVideo.title}`));
            }


            results = await ytdl.getInfo(currentVideo.url).catch(err => {
                if (!this.renderedPlayer)
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
                console.log(truncate_to_window('>> ' + `Read cached audio results for ${currentVideo.title}`));
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
            EE.emit('play-next-track');
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

        let url = 'https://www.yt-download.org/api/button/mp3/' + this.currentVideo.id;

        let body = await miniget(url).text(),
            $ = cheerio.load(body),
            links = $('.download  a').map(function() {
                return $(this).attr('href')
            }).get(),
            link = first(links)

        this.currentAudio.url = link;
        // console.log({ link });
        // attempt to play file again
        await this.play_audio();

    }

    async key_events() {

        let self = this;
        let keyEvent;

        let throttled_key_events = throttle(
            function(a, b, c) {
                // console.log({ a, b });
                keyEvent = find(self.hotKeys, pick(b, 'name', 'ctrl', 'shift', 'meta'));
                if (keyEvent) {
                    // console.log(keyEvent);
                    self.interruptMessage = keyEvent.message;
                    EE.emit(keyEvent.action)
                }
            }, 5000)

        keypress.listen({ stdin: process.stdin }, throttled_key_events);


    }

    async listen_for_events() {
        let self = this;

        let throttledTickerFunc = throttle(self.update_player.bind(self), 1000);

        function run_playlist() {
            this.run_playlist();
        }

        function play_pause() {
            if (this.isPlaying) {
                this.end_ffplay()
            } else {
                this.play_audio(Math.ceil(this.trackLastPlayedTime / 1000))
            }
        }

        function prev_track() {
            // check if we can step back...
            if (this.trackNum > 1) this.trackNum = this.trackNum - 2;
            self.run_playlist();
        }

        // event listeners
        EE.on('play-pause', play_pause, this)
        EE.on('play-next-track', run_playlist, this);
        EE.on('play-previous-track', prev_track, this);
        EE.on('update_player', self.update_player, this)
        EE.on('play-progress', function(time) {
            // update ticker with throttled...
            // logUpdate(time);
            throttledTickerFunc(time);
        });
        EE.on("finished-playback", async function() {

            self.playerStopped = true;

            process.stdin.end()


            // exit procedures...
            // close process
            await self.end_ffplay(true);

            // end timer
            clearInterval(self.idleTickerInterval);

            // remove listeners
            await EE.removeAllListeners();

            await new Promise((resolve, reject) => {

                setTimeout(() => {
                    // persist player
                    logUpdate.done();
                    // if we have an error status, probably why we ended?
                    if (this.errorStatus) {
                        console.log(`>> Playback ended likely because of this error: ${c.red.bold(this.errorStatus)}`);
                    }
                    resolve();
                }, 1000);
            });

            console.log('>> Closing player... Adios!\n');

            // console.log(wtfnode.dump());

        })
    }

    async play(videos) {

        // filter out videos without a valid url
        videos = videos.filter(o => isUrl(o.url));

        let self = this;

        this.totalTracks = videos.length;
        this.trackNum = 0;
        this.totalPlayTime = videos.map(o => o.duration).reduce((a, b) => a + b, 0);
        this.totalPlayedTime = 0;

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
            let playedVideos = arrify(this.playSession.played);
            // filter out played videos
            videos = videos.filter(o => playedVideos.indexOf(o.url) == -1);
        } else {
            // no need for session...
            playCache.delete('playSession');
        }

        //Do we want to shuffle videos
        if (this.flags.shuffle) {
            videos = shuffle(videos);
        }

        // set videos
        this.videos = videos;

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

            // we got this far, means player is loading, so listen for key events
            this.key_events();

            // clear terminal
            clear();


            this.borderLine = `━`.repeat(this.consoleRows);

            let pkgFile = path.join(__dirname, '../../package.json'),
                pkgData = require(pkgFile);

            if (!this.mutePlayerLog) {
                console.log(
                    `\n` +
                    c.gray(await this.log_art() + c.italic(` version ${pkgData.version}`)) + `\n` +
                    this.format_text('header', false) + '\n' +
                    this.format_text('borderline-top', false)
                );
            }
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
            (this.idlingTime > this.settings.playback.timeout * .75 &&
                self.errorStatus !== 'Playback paused till Internet resumes...' ?
                this.format_text('idle-track-line', true, false) : ""
            ) +
            // sep
            this.format_text('gray-sep-line') +
            // show next track if we have more than one track in playlist
            (this.trackNum < this.videos.length || this.flags.loop ? this.format_text('next-track', true, false) : "") +
            // show next track loading info
            (this.nextAudioLoading || this.nextAudioReady ? this.format_text('loading-next-track', true, false) : "") +
            // blank spacing line
            (this.errorStatus ? this.format_text('error-status', true, false) : '') +
            // bottom border line
            this.format_text('borderline-bottom', false);

        if (!this.mutePlayerLog) {
            logUpdate(content);
        }

    }

    async run_playlist() {

        if (this.playerStopped) return;
        // if (this.renderedPlayer && !this.isPlaying) return;

        this.end_ffplay()


        this.isPlaying = false;

        // if there still are files
        if (this.videos.length) {

            // pick video
            let hasCurrentVideo = this.current_video();

            if (hasCurrentVideo) {
                // get audio
                await this.get_audio()
                    .catch(console.error);

                // play file...
                this.play_audio();

            } else {
                EE.emit("finished-playback")
            }


        } else {
            EE.emit("finished-playback");
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

        if (this.playerStopped) return;

        if (!this.currentAudio || !this.currentAudio.url) {
            // play next 
            EE.emit("finished-playback");
            return
        }

        this.nextAudioLoading = false;
        this.nextAudioReady = false;
        this.isPlaying = false;
        this.idlingTime = 0;
        this.trackPlayedTime = 0;
        this.trackVolume = dotProp.get(this, 'settings.playback.volume', 75);
        this.attemptingAudioFallback = false;
        this.errorStatus = null;
        this.isOnline = false;
        this.hasBeeped = false;
        self.interruptMessage = null;

        this.ffplayProcesses = this.ffplayProcesses || {};

        this.trackLastPlayedTime = this.trackLastPlayedTime || 0;

        // force track to start on interrupt

        // console.log('fff', this.currentAudio.url, this.trackNum);
        // console.log({ startSeek });

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

            this.currentAudio.url
        ];


        let ffplaySubProcess = execa(this.ffplayPath, args);

        // child.stdin.write("console.log('Hello from PhantomJS')\n");
        // this.mutePlayerLog = true;
        this.currentFfplayProcess = ffplaySubProcess;

        // play...
        this.ffplayProcesses[size(this.ffplayProcesses)] = {
            track: this.currentAudio.url,
            child: ffplaySubProcess
        }


        clearInterval(this.idleTickerInterval)

        this.idleTickerInterval = setInterval(() => {

            this.idlingTime += 1000;
            this.trackPlayedTime += 1000;
            // this.totalPlayedTime += 1000;

            if (this.idlingTime > this.settings.playback.timeout) {
                // End playback
                // TODO: There seems to be a bug that needs tracing
                this.end_ffplay()
            }

            // if not playing, then the player is also likely not updating...
            if (!self.isPlaying && self.errorStatus !== 'Playback paused till Internet resumes...') {
                EE.emit('update_player');
            }

            if (!this.hasBeeped && self.errorStatus) {
                beeper('**');
                this.hasBeeped = true;
            }

            if (this.hasBeeped && !self.errorStatus) {
                this.hasBeeped = false;
            }

            // continually check internet connection
            isOnline()
                .then((status) => {
                    if (status == false) {
                        this.isOnline = false;
                        // stop playing
                        // having this error state will mean we cannot load the next track....
                        if (self.errorStatus !== 'Playback paused till Internet resumes...') {
                            self.errorStatus = 'No Internet Connection';
                        }

                    } else {

                        if (self.errorStatus == 'Playback paused till Internet resumes...') {
                            // oh we are resuming from a pause....let's ask to continue playback
                            EE.emit('play-next-track');
                        }
                        this.isOnline = true;
                        self.errorStatus = null;
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
                        console.log(c.gray(`  - Initial audio couldn't play. Attempting another...`));
                    await this.audio_fallback();
                } else {
                    if (!this.renderedPlayer)
                        console.log(c.red(`  - Completely unable to play audio for this track. Sorry.`));
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
                    let dataAq = Number(matches[1]);

                    if (dataAq) {

                        // reset idlying time...
                        self.idlingTime = 0;
                        if (!self.isPlaying) {
                            setTimeout(() => {
                                self.isPlaying = true;
                            }, 1000);
                        }


                        // convert ffplay time to ms & emit
                        let timeMS = duration_to_ms(time),
                            pc = timeMS / self.currentVideo.duration;

                        this.trackLastPlayedTime = timeMS;

                        EE.emit('play-progress', timeMS);

                        // when we get to 80% percentage, 
                        // start loading next audio to avoid play lag
                        // because audio data is cached too, we don't need to load again when we get to track
                        if (pc >= .8) {

                            // if no other track is loading, if we havent loaded any other track, and are online
                            if (!self.nextAudioLoading && !this.nextAudioReady && this.isOnline) {

                                if (this.trackNum < this.videos.length) {
                                    self.nextAudioLoading = true;
                                    self.get_audio(this.videos[this.trackNum]);
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

        ffplaySubProcess.stderr.on('end', (data) => {
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
                        this.playSession.played.push(this.currentVideo.url);
                        // mark current
                        this.playSession.currentTrackNum = this.trackNum - 1;

                        playCache.set('playSession', this.playSession)
                    }


                    // try play next ....
                    EE.emit('play-next-track');
                }


            } else if (self.errorStatus) {
                // Let user know we are paused
                if (self.errorStatus == 'No Internet Connection') {
                    self.errorStatus = 'Playback paused till Internet resumes...';
                    EE.emit('update_player');
                    // step back to same hung track
                    this.trackNum--;
                }
            }
        })



    }


}


module.exports = (opts) => new Player(opts)