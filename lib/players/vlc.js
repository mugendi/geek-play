/*-------------------------------------------------------------------------------------------------------------------
    Modules
//-------------------------------------------------------------------------------------------------------------------*/
const VLC = require("vlc-client"),
    vlcCommand = require('vlc-command'),
    open = require('open'),
    isUrl = require('is-url'),
    shuffle = require('lodash/shuffle');

class Player {
    constructor(opts) {
        let self = this;

        for (let k in opts) {
            self[k] = opts[k];
        }

        // ensure vlc
        // this.ensure_vlc(opts);


    }

    async play(videos) {

        // filter out videos without a valid url
        videos = videos.filter(o => isUrl(o.url));

        if (videos.length == 0) return;


        //is vlc ok?
        if (!this.vlc) await this.ensure_vlc();

        // Do we want to add files to current playlist?
        if (this.settings.playback.addToPlaylist == 'no') {
            // clear playlist
            this.vlc.emptyPlaylist();
        }

        //Do we want to shuffle videos
        if (this.flags.shuffle) {
            videos = shuffle(videos);
        }

        // send videos to vlc
        for (let video of videos) {
            this.vlc.addToPlaylist(video.url);
        }

        // start playing 
        let playlist = await this.vlc.getPlaylist();

        // play first id
        this.vlc.playFromPlaylist(playlist[0].id);

    }


    // ensures vlc is running
    async ensure_vlc(opts) {

        this.vlc = new VLC.Client({
            ip: this.settings.vlc.server,
            port: Number(this.settings.vlc.port),
            username: this.settings.vlc.username, //username is optional
            password: this.settings.vlc.password
        })


        let status = await this.vlc.status().catch(err => err.code);

        if (status == 'ECONNREFUSED') {
            console.log(`It seems like VLC is not running.... Attempting to open...`);
        } else {
            // all good return 
            return;
        }

        let vlcPath = await new Promise((resolve, reject) => {
            vlcCommand(function(err, vlcPath) {
                console.log({ err, vlcPath });
                if (err) reject(err);
                else resolve(vlcPath)
            });
        }).catch(err => null);


        if (!vlcPath) {
            spinner.fail('Could not find VLC path!');
            console.log('Try Open VLC manually');
            return;
        }

        // attempt to open
        let vlcPID = await open(vlcPath).then(resp => resp.pid).catch(err => null);

        if (vlcPID) {

            return new Promise((resolve, reject) => {
                // wait a little to be sure that VLC is ready to receive commands
                setTimeout(() => {
                    console.log('VLC Open');
                    resolve(this.vlc)
                }, 1000);
            })

        } else {
            spinner.fail('Could not open VLC!');
            console.log('Try Open VLC manually');
            return
        }

    }

}


module.exports = (opts) => new Player(opts)