/*-------------------------------------------------------------------------------------------------------------------
    Modules
//-------------------------------------------------------------------------------------------------------------------*/

const Conf = require('conf'),
    meow = require('meow'),
    figlet = require('figlet'),
    clear = require('clear');


/*-------------------------------------------------------------------------------------------------------------------
    Local
//-------------------------------------------------------------------------------------------------------------------*/

const config = new Conf(),
    { get_settings, setting_prompt, accepted_settings, compulsorySettings } = require('../lib/cli-prompts'),
    { download_ffplay } = require("../lib/setup")


process.env.YTDL_NO_UPDATE = true;


const cli = meow(`
Usage
  $ geekplay <input>

Options
    --setting         Setting to edit. Accepts "${accepted_settings()}"
    --shuffle         Shuffle videos pay order from that of search results or playlist.    
    --name            Playlist Name. Defaults to playlist ID or search Query
    --save            Save Playlist. Default is true. 
    --play            Start playing. Default is true;
    --vlc             Play using VLC. Defaults to inbuilt mp3. 
    
    --no-save         Do not save playlist.

Examples
  $ geekplay eminem --rainbow --mp3
 
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
    let newSettings = await get_settings(settingsArr);

    // set any new settings
    if (newSettings) {
        for (let key in newSettings) {
            config.set(`settings.${key}`, newSettings[key]);
        }
    }

}


// get/set settings
(async() => {

    await identity();


    // config.delete('ffplay-path');
    // setup things
    // do we have ffplay?
    if (!config.get('ffplay-path')) {
        await download_ffplay();
    }
    // console.log(config.get('ffplay-path'));

    // set default platform.
    // config.delete('settings');
    // later will be moved to cli options
    config.set('settings.platforms', {
        available: ['youtube'],
        default: 'youtube'
    })

    // get any missing settings. 
    // usually runs the first time app starts
    await get_set_settings();


    let appSettings = config.get('settings') || {};

    // Force vlc setup
    if (appSettings.player == 'vlc' && !appSettings.vlc) {
        // ensure vlc
        await get_set_settings(['vlc']);
    }


    //if a user wants to set a particular setting
    if (cli.flags.setting) {
        if (cli.flags.setting == '*') {
            await get_set_settings(compulsorySettings)
        } else {
            await get_set_settings([cli.flags.setting]);
        }

    }


    let cliInput = cli.input.join(' '),
        cliFlags = cli.flags;
    // update settings 
    appSettings = config.get('settings') || {};

    let c = figlet.textSync(' GeekPlay')


    if (appSettings) {
        if (!cliInput) console.log(`>> Nothing more to do here! Bye!`);
        require('../')(cliInput, cliFlags, appSettings);
    }


})()

function identity(params) {

    let welcomeShown = config.get('settings');

    if (welcomeShown) return;

    return new Promise(async(resolve, reject) => {

        console.log(
            `${figlet.textSync(' GeekPlay')} simple, elegant, works.                                
                                                                                                
Queued 19 Tracks > Playtime: 1 hour 26 minutes 53 seconds                               
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓      
┃                                                                                ┃      
┃  Track: 1/19 [>] Enjoy your music as you code!                                 ┃      
┃  [■■                   8.3%] 03:11 | 160kbps | 3.34MB | 80.2m YT Views         ┃      
┃  ----------------------------------------------------------------------------  ┃      
┃                              > Next: Remember to push your code to Github!     ┃      
┃                                                                                ┃      
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛      

Brought to you with ♥ from Anthony Mugendi <https://github.com/mugendi>
    
    `)


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