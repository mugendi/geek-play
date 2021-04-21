/*-------------------------------------------------------------------------------------------------------------------
    Modules
//-------------------------------------------------------------------------------------------------------------------*/

const ytsr = require('ytsr'),
    fs = require('fs-extra'),
    path = require('path');


/*-------------------------------------------------------------------------------------------------------------------
    Local
//-------------------------------------------------------------------------------------------------------------------*/

const Cache = require("../../cache"),
    players = require('../../players'),
    playlist = require("../../playlist"),
    { duration_filter } = require('../../common');




class Search {

    constructor(cliInput, cliFlags, appSettings) {

        this.input = cliInput;
        this.flags = cliFlags;
        this.settings = appSettings;

        this.action = 'search'


        this.run();

    }



    async run() {

        let cache = Cache('cache');
        let videos = cache.get('search', this.input);


        if (videos) {
            console.log('>> ' + `Read cached data for "${this.input}"`);
        } else {

            console.log('>> ' + `Searching for "${this.input}"`);

            // search
            const searchResults = await ytsr(this.input, { limit: this.settings.playback.limit });
            // filter videos out 
            videos = searchResults.items.filter(o => o.type == 'video');

            // save cache
            cache.set('search', this.input, videos);
        }

        // filter videos by duration
        videos = duration_filter(videos, this.settings.playback.maxDuration);

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

module.exports = (cliInput, cliFlags, appSettings) => new Search(cliInput, cliFlags, appSettings)