/*-------------------------------------------------------------------------------------------------------------------
    Modules
//-------------------------------------------------------------------------------------------------------------------*/

const isUrl = require('is-url')

/*-------------------------------------------------------------------------------------------------------------------
    Local
//-------------------------------------------------------------------------------------------------------------------*/
const platformActions = require('./lib/platforms')




function start(cliInput, cliFlags, appSettings) {
    // console.log(appSettings.platforms.default);

    if (cliInput.trim().length) {

        // console.log(cliInput, cliFlags, appSettings);
        // determine type of input
        if (isUrl(cliInput)) {
            // use playlist
            let action = platformActions[appSettings.platforms.default];
            action.playlist(cliInput, cliFlags, appSettings)
        } else {
            // use search
            let action = platformActions[appSettings.platforms.default];
            action.search(cliInput, cliFlags, appSettings)
        }

    }

}



module.exports = start;