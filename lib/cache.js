/*-------------------------------------------------------------------------------------------------------------------
    Modules
//-------------------------------------------------------------------------------------------------------------------*/
const envPaths = require('env-paths'),
    filenamify = require('filenamify'),
    path = require('upath'),
    Conf = require('conf'),
    fs = require('fs-extra'),
    fg = require('fast-glob'),
    moment = require('moment'),
    kindOf = require('kind-of'),
    kebabCase = require('lodash/kebabCase');

/*-------------------------------------------------------------------------------------------------------------------
    Local
//-------------------------------------------------------------------------------------------------------------------*/
const appEnvPaths = envPaths('geek-player'),
    config = new Conf(),
    appSettings = config.get('settings');


let cacheName, cacheDuration;


function get_cache_dir() {

    let dir = path.join(appEnvPaths.data, cacheName);

    // ensure directories
    fs.ensureDirSync(appEnvPaths.data);
    fs.ensureDirSync(dir);

    return dir;
}

function get_cache_file_path(action, name) {

    let fileName = filenamify(`${action}-${kebabCase(name)}.json`),
        filePath = path.join(get_cache_dir(), fileName);

    return filePath;
}

async function weed_cache() {

    let dir = get_cache_dir();

    fg(path.join(dir, '*'), { stats: true })
        .then((files) => {
            for (let file of files) {
                if (is_expired(file.stats)) {
                    fs.existsSync(file) && fs.unlink(file.path);
                }
            }
        })
        .catch(console.error)

}

function is_expired(stats) {

    //when was this file created
    let lastUpdated = moment(stats.ctimeMs),
        // so when is t expected to expire?
        expires = lastUpdated.add(appSettings.storage.cache, 'milliseconds'),
        // Oh. So might it have expired?
        isExpired = moment().isAfter(expires);

    return isExpired;

}

function set(action, input, data) {

    let cacheFile = get_cache_file_path(action, input);



    if (['array', 'object'].indexOf(kindOf(data)) > -1) {
        fs.writeJsonSync(cacheFile, data);
        return true;
    }

    return false;

}

function get(action, input) {
    // every cache get triggers a function to weed the cache
    weed_cache();

    let cacheFile = get_cache_file_path(action, input);

    // if no file 
    if (!fs.existsSync(cacheFile)) return null;

    // check if file is expired
    let stats = fs.statSync(cacheFile);

    // otherwise read file
    let data = fs.readJSONSync(cacheFile);



    return data;
}

function del(action, input) {
    let cacheFile = get_cache_file_path(action, input);
    return fs.existsSync(cacheFile) && fs.unlinkSync(cacheFile);
}

module.exports = (name = 'cache') => {
    cacheName = name;
    // cacheDuration = duration;
    return {set, get, del }
}