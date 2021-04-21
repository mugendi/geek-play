/*-------------------------------------------------------------------------------------------------------------------
    Modules
//-------------------------------------------------------------------------------------------------------------------*/

const Conf = require('conf'),
    enquirer = require('enquirer'),
    dotProp = require('dot-prop'),
    c = require('ansi-colors'),
    ospath = require('ospath'),
    path = require('path'),
    Joi = require('joi'),
    parseDuration = require('parse-duration'),
    prettyMs = require("pretty-ms"),
    _ = require('lodash');

/*-------------------------------------------------------------------------------------------------------------------
    App Constants
//-------------------------------------------------------------------------------------------------------------------*/

const config = new Conf(),
    { Form, Select } = require('enquirer'),
    appSettings = config.get('settings') || {},
    promptHelper = require('./prompt-helper'),
    { random_str } = require('./common');


// the main prompts
const Prompts = {
    vlc: {
        name: "vlc",
        type: 'Form',
        message: 'We need to setup your VLC web interface. http://bit.ly/VLC-WEB for details. \n  ' + promptHelper.OptsNavigation + '\n',
        choices: [
            { name: 'server', message: 'VLC Web Interface Server (required)', initial: 'localhost' },
            { name: 'port', message: 'VLC Web Interface Port (required)', initial: '8080' },
            { name: 'password', message: 'VLC Web Interface Password (required)', initial: '' },
            { name: 'username', message: 'VLC Web Interface Username (optional)', initial: '' }
        ]
    },
    playback: {
        name: 'playback',
        type: 'Form',
        message: 'We need to setup your playback options \n  ' + promptHelper.OptsNavigation + '\n',
        choices: [
            { name: 'addToPlaylist', message: 'Add new tracks to existing playlist', initial: 'yes' },
            { name: 'volume', message: 'Playback Volume (number: 1-100)', initial: '75' },
            { name: 'limit', message: 'Number of Videos/Audio to fetch (number)', initial: '200' },
            { name: 'timeout', message: 'Timeout duration if playback freezes', initial: '20 seconds' },
        ]
    },
    storage: {
        name: 'storage',
        type: 'Form',
        message: 'We need to setup your storage options \n  ' + promptHelper.OptsNavigation + '\n',
        choices: [
            { name: 'playlist', message: 'Where to store your playlists', initial: path.join(ospath.desktop(), 'geekplay') },
            { name: 'cache', message: 'How Long to cache search results', initial: '3 days' },
        ]
    },
    player: {
        name: 'color',
        type: "Select",
        message: 'Pick a flavor',
        choices: ['gk-mp3', 'vlc']
    }

}

function validate_duration(value, helper) {
    let duration = parseDuration(value);
    if (!duration) {
        return helper.message("Invalid cache duration. Enter a value like '3 days, 30 seconds'");
    } else {
        return duration
    }
}

function validate_yes_no(value, helper) {
    let expected = ['yes', 'no'],
        lCase = String(value).toLocaleLowerCase(),
        isTrue = (expected.indexOf(lCase) > -1);

    if (!isTrue) {
        return helper.message("Invalid value entered. Expected either 'Yes' or 'No' ");
    } else {
        return lCase
    }
}


// schemas
const validationSchemas = {
    vlc: Joi.object({
        username: Joi.string().empty(''),
        password: Joi.string().required().min(1),
        server: Joi.string().required(),
        port: Joi.string().required()
    }),
    storage: Joi.object({
        playlist: Joi.string().required(),
        cache: Joi.string().required().custom(validate_duration)
    }),
    playback: Joi.object({
        volume: Joi.number().min(0).max(100),
        limit: Joi.number().min(10).max(5000),
        addToPlaylist: Joi.string().custom(validate_yes_no),
        timeout: Joi.string().required().custom(validate_duration)
    }),
    player: Joi.string().required()
}

// special duration validations
// saved as MS but displayed as date strings via pretty-ms
const durationSettings = ['cache', 'timeout']



async function show_prompt(key, error) {

    let params = _.clone(Prompts[key]);
    // new random key so we can show same prompt
    params.name = random_str(4);

    let settingVal;

    // set any existing values
    for (let option of params.choices) {
        if (appSettings[key] && appSettings[key][option.name]) {

            if (durationSettings.indexOf(option.name) > -1) {
                settingVal = prettyMs(appSettings[key][option.name], { verbose: true })
            } else {
                settingVal = String(appSettings[key][option.name])
            }
            // set as initial
            option.initial = settingVal;
        }
    }

    if (error) {
        params.message = `We have an error, please correct to proceed! \n` + c.red(`  Error: ${error.message}`)
    }

    let prompt;

    switch (params.type) {
        case "Form":
            prompt = new Form(params);
            break;

        case "Select":
            prompt = new Select(params);
            break;

        default:
            break;
    }



    return prompt.run()
}

function accepted_settings() {
    let accepted = _.keys(Prompts);
    return `${accepted.slice(0,-1).join(', ')} or ${accepted[accepted.length-1]}`
}
async function setting_prompt(key) {
    let answer, validation;

    if (!_.has(Prompts, key)) {

        throw new Error(`No such setting (${key}) exists! Try either "${accepted_settings()}"`)
    }

    answer = await show_prompt(key);

    validation = validationSchemas[key].validate(answer);

    // while we have an error
    while (validation.error) {
        // get answer
        answer = await show_prompt(key, validation.error);
        // validate answer
        validation = validationSchemas[key].validate(answer);
    }


    return validation.value

}

async function get_settings() {

    let newSettings = {};

    for (let key in Prompts) {
        if (_.isEmpty(appSettings[key])) {
            newSettings[key] = await setting_prompt(key);
        }
    }


    return _.isEmpty(newSettings) ? null : newSettings;

}


module.exports = {
    get_settings,
    setting_prompt,
    accepted_settings
}