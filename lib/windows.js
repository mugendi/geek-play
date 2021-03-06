const prompts = require('prompts'),
    kleur = require('kleur'),
    parseDuration = require('parse-duration'),
    prettyMs = require("pretty-ms"),
    ospath = require('ospath'),
    path = require('path'),
    kindOf = require('kind-of'),
    Conf = require('conf'),
    toLower = require('lodash/toLower'),
    fs = require('fs-extra');




const config = new Conf();


class Windows {

    constructor(opts) {
        this.player = opts;
    }

    async settings() {

        // console.log(this.player.settings);
        // header
        console.log("\n" + kleur.bold().yellow(`SETTINGS`));
        console.log(kleur.bold().yellow(this.player.borderLine) + '\n');

        let settings = this.player.settings;


        let response = await prompts({
            type: 'select',
            name: 'setting',
            message: 'Which Settings Do You Wish to Edit?',
            choices: [{
                title: 'Playback',
                value: 'playback'
            }, {
                title: 'Storage',
                value: 'storage'
            }]

            // validate: value => value < 18 ? `Nightclub is 18+ only` : true
        });

        let opts = [];

        switch (response.setting) {
            case 'storage':
                opts = [
                    // cache
                    {
                        type: 'text',
                        name: 'cache',
                        message: 'How long do you want to cache files?',
                        initial: prettyMs(settings.storage.cache, { verbose: true }) || '3 days',
                        validate: validate_duration,
                        format: v => parseDuration(v)
                    },
                    // playlist dir
                    {
                        type: 'text',
                        name: 'playlist',
                        message: 'Where should we store your playlists?',
                        initial: settings.storage.playlist || path.join(ospath.desktop(), 'geekplay'),
                        // ensure mother folder exists
                        validate: v => {
                            let dir = path.dirname(v);
                            if (fs.existsSync(dir)) return true;
                            return `The directory ${dir} does not exist! Enter a different Path.`
                        }
                    }
                ]

                break;
            case 'playback':

                opts = [
                    // 
                    {
                        type: 'text',
                        name: 'addToPlaylist',
                        message: 'Add new tracks to your playlist?',
                        initial: settings.playback.addToPlaylist || 'No',
                        validate: validate_yes_no
                    },
                    {
                        type: 'text',
                        name: 'continueLastSession',
                        message: 'Continue playback from last session?',
                        initial: settings.playback.addToPlaylist || 'No',
                        validate: validate_yes_no
                    },
                    {
                        type: 'number',
                        name: 'volume',
                        message: 'How loud do you want your music? Enter number (0-100)',
                        initial: Number(settings.playback.volume) || 50,
                        validate: v => !v || (v >= 0 && v <= 100) ? true : "Enter a number between 0 and 100"
                    },
                    {
                        type: 'number',
                        name: 'limit',
                        message: 'How many tracks do you want to fetch from YouTube? Enter number (0-500)',
                        initial: settings.playback.limit || 100,
                        validate: v => !v || (v >= 0 && v <= 500) ? true : "Enter a number between 0 and 500"
                    },
                    {
                        type: 'text',
                        name: 'timeout',
                        message: 'Timeout duration if playback freezes?',
                        initial: prettyMs(settings.playback.timeout, { verbose: true }) || '20 seconds',
                        validate: validate_duration,
                        format: v => parseDuration(v)
                    },
                ]

                break;

            default:
                break;
        }


        settings[response.setting] = await prompts(opts);

        // console.log(settings);
        // Save settings
        // appSettings = config.get('settings') 
        config.set('settings', settings);

        return 'Settings successfully saved! New settings take effect immediately!';

    }

    async playlist() {



        // header
        console.log("\n" + kleur.bold().yellow(`PLAYLIST - ${this.player.sources.length} Tracks`));
        console.log(kleur.bold().yellow(this.player.borderLine) + '\n');


        const response = await prompts({
            type: 'autocomplete',
            name: 'value',
            message: 'Select a Track to play. Type anything to filter.',
            initial: this.player.trackNum - 1,
            suggest,
            choices: this.player.sources.map((o, i) => {
                    let title = o.title,
                        disabled;

                    return {
                        title: `${i+1}) ${title} - [${prettyMs(o.duration,{colonNotation: true})}]`,
                        search: {
                            text: (i + 1) + '-' + toLower(title),
                            duration: o.duration
                        },
                        value: {
                            num: i,
                            title
                        }
                    }
                })
                // .filter((o, i) => i + 1 !== this.player.trackNum)
        });


        if (response && response.value) {

            this.player.trackNum = response.value.num;
            this.player.run_playlist();

            return `Playing "${response.value.title}"...`;

        }

    }

}



function suggest(a, b) {

    let resp = [];

    for (let d of b) {

        if (d.search.text.indexOf(toLower(a)) > -1) {
            resp.push(d)
        }
    }

    return resp
}


function validate_duration(value) {
    if (parseDuration(value)) return true;
    return 'You must enter a duration such as "2 days", "5 hours" and so on.'
}

function validate_yes_no(value) {
    console.log(value);
    if (['yes', 'no'].indexOf(value.toLowerCase()) > -1) return true;
    return `${value} is invalid. Expected "Yes/No"`
}



module.exports = (opts) => new Windows(opts)