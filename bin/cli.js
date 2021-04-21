/*-------------------------------------------------------------------------------------------------------------------
    Modules
//-------------------------------------------------------------------------------------------------------------------*/

const Conf = require('conf'),
    meow = require('meow');


/*-------------------------------------------------------------------------------------------------------------------
    Local
//-------------------------------------------------------------------------------------------------------------------*/

const config = new Conf(),
    { get_settings, setting_prompt, accepted_settings } = require('../lib/cli-prompts');


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



// get/set settings
(async() => {

    // set default platform.
    // config.delete('settings');
    // later will be moved to cli options
    config.set('settings.platforms', {
        available: ['youtube'],
        default: 'youtube'
    })

    // get any missing settings. 
    // usually runs the first time app starts
    let newSettings = await get_settings();

    // set any new settings
    if (newSettings) {
        for (let key in newSettings) {
            config.set(`settings.${key}`, newSettings[key]);
        }

    }

    //if a user wants to set a particular setting
    if (cli.flags.setting) {
        console.log('sssss', cli.flags.setting);
        let newSetting = await setting_prompt(cli.flags.setting);
        config.set(`settings.${cli.flags.setting}`, newSetting);
    }


    let appSettings = config.get('settings') || {},
        cliInput = cli.input.join(' '),
        cliFlags = cli.flags;


    if (appSettings) {
        require('../')(cliInput, cliFlags, appSettings);
    }


})()