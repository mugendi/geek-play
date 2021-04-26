#!/usr/bin/env node


/*-------------------------------------------------------------------------------------------------------------------
    Modules
//-------------------------------------------------------------------------------------------------------------------*/

const Conf = require('conf'),
    meow = require('meow'),
    figlet = require('figlet'),
    clear = require('clear'),
    ospath = require('ospath'),
    path = require('path'),
    kleur = require('kleur'),
    isOnline = require('is-online'),
    updateNotifier = require('update-notifier');


/*-------------------------------------------------------------------------------------------------------------------
    Local
//-------------------------------------------------------------------------------------------------------------------*/

const config = new Conf(),
    // { get_settings, setting_prompt, accepted_settings, compulsorySettings } = require('../lib/cli-prompts'),
    { download_ffplay } = require("../lib/setup")


// no updates for YTDL
process.env.YTDL_NO_UPDATE = true;

// update notifier
const pkg = require('../package.json');
updateNotifier({ pkg }).notify();

const cli = meow(`
Usage
  $ geekplay <input> <options>

Options

    ${kleur.yellow('Playback Options:')}
        --vlc             Play using VLC
        --play            Start playing (default true)
        --shuffle         Shuffle tracks (default false)
        --loop            Loop Playlist (default false)

    ${kleur.yellow('Playlist Options:')}
        --name            Playlist Name (default, playlist ID or search query)
        --save            Save Playlist (default true) 
        --no-save         Do not save playlist 


Example:
   $ geekplay eminem --loop --shuffle
   ${kleur.gray().italic('Searches for Eminem tracks, plays them in shuffled order and repeats entire playlist')}
 
`, {
    flags: {
        setting: {
            type: 'string',
            alias: 's'
        },
        shuffle: {
            type: "boolean",
            default: false
        },
        loop: {
            type: "boolean",
            default: false
        },
        player: {
            type: 'string'
        },

        play: {
            type: "boolean",
            default: true
        },

        pl_save: {
            type: "boolean",
            alias: 's',
            default: true
        },
        pl_name: {
            type: "string",
            alias: "n"
        },
    }

});


async function get_set_settings(settingsArr = []) {

    // get settings
    // let newSettings = await get_settings(settingsArr);

    // set any new settings
    if (newSettings) {
        for (let key in newSettings) {
            if (newSettings[key])
                config.set(`settings.${key}`, newSettings[key]);
        }
    }

}


// get/set settings
(async() => {


    // set default platform.
    // config.delete('settings');

    if (!await isOnline()) {
        console.log(kleur.red().bold(">> We seem to have no Internet Connection..."));
        console.log(`>> Nothing more to do here! Bye!`);
        return;
    }

    await identity();

    // config.delete('ffplay-path');
    // setup things
    // do we have ffplay?
    if (!config.get('ffplay-path')) {
        await download_ffplay();
    }
    // console.log(config.get('ffplay-path'));


    // get any missing settings. 
    // usually runs the first time app starts
    // await get_set_settings();


    let appSettings = config.get('settings') || {};

    let cliInput = cli.input.join(' '),
        cliFlags = cli.flags;
    // update settings 
    appSettings = config.get('settings');


    if (appSettings) {
        if (!cliInput) console.log(`>> Nothing more to do here! Bye!`);
        require('../')(cliInput, cliFlags, appSettings);
    }


})()

function identity(params) {

    let welcomeShown = config.get('settings');

    if (welcomeShown) return;

    // set defaults

    // later will be moved to cli options
    let defaultSettings = {
        storage: {
            playlist: path.join(ospath.desktop(), 'geekplay'),
            // 3 days
            cache: 3 * 24 * 3600 * 1000
        },
        playback: {
            addToPlaylist: 'yes',
            continueLastSession: 'yes',
            volume: 75,
            limit: 200,
            // 3 hrs
            maxDuration: 3 * 3600 * 1000,
            timeout: 20000
        },
        player: 'gk-mp3',
        platforms: {
            available: ['youtube'],
            default: 'youtube'
        }
    }

    config.set('settings', defaultSettings)


    return new Promise(async(resolve, reject) => {

        console.log(
            `${figlet.textSync(' GeekPlay')} simple, elegant, works.\n\n` +
            `Brought to you with ♥ from Anthony Mugendi <https://github.com/mugendi>`
        )


        setTimeout(() => {
            clear();
            resolve();
        }, 5000);


    });

}


// Handle process exit
// process.stdin.resume(); //so the program will not close instantly

// function exitHandler(options, exitCode) {

//     if (options.cleanup) {
//         // clear console
//         clear();
//     }
//     if (exitCode || exitCode === 0)
//         if (options.exit) process.exit();
// }

// //do something when app is closing
// process.on('exit', exitHandler.bind(null, { cleanup: true }));

// //catches ctrl+c event
// process.on('SIGINT', exitHandler.bind(null, { exit: true }));

// // catches "kill pid" (for example: nodemon restart)
// process.on('SIGUSR1', exitHandler.bind(null, { exit: true }));
// process.on('SIGUSR2', exitHandler.bind(null, { exit: true }));

// //catches uncaught exceptions
// process.on('uncaughtException', exitHandler.bind(null, { exit: true }));