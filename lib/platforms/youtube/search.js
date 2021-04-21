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
    playlist = require("../../playlist");




class Search {

    constructor(cliInput, cliFlags, appSettings) {

        this.input = cliInput;
        this.flags = cliFlags;
        this.settings = appSettings;

        this.action = 'search'


        this.run();

    }



    async run() {

        // console.log(this);
        // cache.del('search', this.input);

        let cache = Cache('cache')

        let videos = cache.get('search', this.input);

        // console.log(videos);


        if (videos) {
            console.log(`Read cached data for "${this.input}"`);
        } else {

            console.log(`Searching for "${this.input}"`);

            // search
            const searchResults = await ytsr(this.input, { limit: this.settings.playback.limit });
            // filter videos out 
            videos = searchResults.items.filter(o => o.type == 'video');

            // save cache
            cache.set('search', this.input, videos);
        }

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
        if (this.flags.plSave && this.mediaType == 'video') {
            // instantiate
            let Playlist = playlist(this);
            // save
            Playlist.save(videos);
        }

    }




}

module.exports = (cliInput, cliFlags, appSettings) => new Search(cliInput, cliFlags, appSettings)