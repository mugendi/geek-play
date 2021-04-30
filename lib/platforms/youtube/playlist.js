/*-------------------------------------------------------------------------------------------------------------------
    Modules
//-------------------------------------------------------------------------------------------------------------------*/

const dotProp = require('dot-prop'),
    fs = require('fs-extra'),
    path = require('path');


/*-------------------------------------------------------------------------------------------------------------------
    Local
//-------------------------------------------------------------------------------------------------------------------*/

const Cache = require("../../cache"),
    players = require('../../players'),
    playlist = require("../../playlist"),
    ytdl = require('../youtube/ytdl-core'),
    ytpl = require('../youtube/ytpl'),
    { duration_filter } = require('../../common');;




class Playlist {

    constructor(cliInput, cliFlags, appSettings, EE) {

        this.input = cliInput;
        this.flags = cliFlags;
        this.settings = appSettings;

        this.action = 'playlist';
        this.EE = EE;


        this.run();

    }



    async run() {
        let self = this;

        let cache = Cache('cache')

        // cache.del('playlist', this.input);

        let videos = cache.get('playlist', this.input);

        if (videos) {
            console.log('>> ' + `Read cached data for "${this.input}"`);
        } else {

            console.log('>> ' + `Fetching Link: "${this.input}"`);

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
                                        title: video.title,
                                        items: [video]
                                    }
                                } else {
                                    throw new Error(`Couldn't resolve the link: ${this.input}`);
                                }

                            })
                    }
                })


            if (playlistResults) {
                self.flags.plName = self.flags.name || playlistResults.title;
                // filter videos out 
                videos = playlistResults.items.map(o => {
                    o.url = o.shortUrl || o.url;
                    return o
                });

                // save cache
                cache.set('playlist', this.input, videos);
            } else {
                videos = [];
            }
        }


        if (videos.length > 0) {

            // filter videos by duration
            videos = duration_filter(videos, this.settings.playback.maxDuration);

            // console.log(videos);

            // do what with videos?
            // first we determine the player
            this.playerName = this.flags.player || this.settings.player;

            if (!players[this.playerName]) {
                throw new Error(`The player ${player} is not recognized.`)
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

            // if we are to play
            if (this.flags.play) {

                // require player
                let Player = players[this.playerName](this);

                // now play videos
                Player.play(videos);
            }

        }


    }




}

module.exports = (cliInput, cliFlags, appSettings, EE) => new Playlist(cliInput, cliFlags, appSettings, EE)