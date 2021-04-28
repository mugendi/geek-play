/*-------------------------------------------------------------------------------------------------------------------
    Modules
//-------------------------------------------------------------------------------------------------------------------*/

const isUrl = require('is-url'),
    EventEmitter = require('eventemitter3'),
    EE = new EventEmitter();

/*-------------------------------------------------------------------------------------------------------------------
    Local
//-------------------------------------------------------------------------------------------------------------------*/
const platformActions = require('./lib/platforms')




function start(cliInput, cliFlags, appSettings) {
    // console.log(appSettings);

    if (cliInput.trim().length) {

        // console.log(cliInput, cliFlags, appSettings);
        // determine type of input
        if (isUrl(cliInput)) {
            // use playlist
            let action = platformActions[appSettings.platforms.default];
            action.playlist(cliInput, cliFlags, appSettings, EE)
        } else {
            // use search
            let action = platformActions[appSettings.platforms.default];
            action.search(cliInput, cliFlags, appSettings, EE)
        }

    }

}




module.exports = start;