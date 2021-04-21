/*-------------------------------------------------------------------------------------------------------------------
    Modules
//-------------------------------------------------------------------------------------------------------------------*/

const dotProp = require('dot-prop'),
    ytpl = require('ytpl'),
    fs = require('fs-extra'),
    path = require('path');


/*-------------------------------------------------------------------------------------------------------------------
    Local
//-------------------------------------------------------------------------------------------------------------------*/

const Cache = require("../../cache"),
    players = require('../../players'),
    playlist = require("../../playlist"),
    { duration_filter } = require('../../common');;




class Playlist {

    constructor(cliInput, cliFlags, appSettings) {

        this.input = cliInput;
        this.flags = cliFlags;
        this.settings = appSettings;

        this.action = 'playlist'


        this.run();

    }



    async run() {

        let cache = Cache('cache')

        // cache.del('playlist', this.input);

        let videos = cache.get('playlist', this.input);

        if (videos) {
            console.log('>> ' + `Read cached data for "${this.input}"`);
        } else {

            console.log('>> ' + `Fetching Link: "${this.input}"`);

            const ytdl = require('ytdl-core');

            // playlist
            // const playlist = await ytpl('UU_aEa8K-EOJ3D6gOs7HcyNg');
            const playlistResults = await ytpl(this.input, { limit: this.settings.playback.limit })
                .catch((error) => {
                    if (error.message.indexOf('Unable to find a id') > -1) {
                        // attempt to download
                        return ytdl.getInfo(this.input)
                            .then((resp) => {

                                if (resp.videoDetails) {
                                    let video = resp.videoDetails;
                                    video.url = dotProp.get(video, 'video_url');
                                    video.views = dotProp.get(video, 'viewCount', 0);
                                    video.duration = dotProp.get(resp, 'player_response.videoDetails.lengthSeconds', 0)

                                    return {
                                        items: [video]
                                    }
                                } else {
                                    throw new Error(`Couldn't resolve the link: ${this.input}`);
                                }

                            })
                    }
                })


            // filter videos out 
            videos = playlistResults.items.map(o => {
                o.url = o.shortUrl || o.url;
                return o
            });

            // save cache
            cache.set('playlist', this.input, videos);
        }

        // filter videos by duration
        videos = duration_filter(videos, this.settings.playback.maxDuration);

        // do what with videos?
        // first we determine the player
        this.playerName = this.flags.player || this.settings.player;

        if (!players[this.playerName]) {
            throw new Error(`The player ${player} is not recognized.`)
        }

        // if we are to play
        if (this.flags.play) {

            // require player
            let Player = players[this.playerName](this);

            // now play videos
            Player.play(videos);
        }

        this.mediaType = this.playerName == 'gk-mp3' ? 'audio' : 'video';

        // do we want to save playlist?
        if (this.flags.plSave
            // TODO: How do we deal with audio playlists?
            // && this.mediaType == 'video'
        ) {
            // instantiate
            let Playlist = playlist(this);
            // save
            Playlist.save(videos);
        }

    }




}

module.exports = (cliInput, cliFlags, appSettings) => new Playlist(cliInput, cliFlags, appSettings)