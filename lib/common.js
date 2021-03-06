/*-------------------------------------------------------------------------------------------------------------------
    Modules
//-------------------------------------------------------------------------------------------------------------------*/

const kindOf = require('kind-of'),
    prettyMS = require('pretty-ms'),
    kleur = require("kleur")

function random_str(length = 10) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

function duration_to_s(str) {

    if (kindOf(str) !== 'string') return 0;

    let seconds = [1, 60, 3600],
        arr = str.split(':').reverse(),
        duration = arr.map((d, i) => Number(d) * seconds[i])
        .reduce((a, b) => a + b, 0);

    return duration;


}

function duration_to_ms(str) {
    return duration_to_s(str) * 1000;
}

function strip_non_ascii(str) {
    return str.replace(/[^\x00-\xFF]/g, "");
}

function truncate_to_window(str) {
    str = strip_non_ascii(str);
    if (str.length + 6 > process.stdout.columns) {
        str = str.slice(0, process.stdout.columns - 6) + ' ...'
    }
    return str;
}

function duration_filter(videos, maxDuration) {
    let unfilteredVideos = [].concat(videos);



    videos = videos.map(o => {
        o.duration = duration_to_ms(o.duration);
        // ensure video
        o.type = 'video';
        return o
    })


    /*
    // .filter(o => {
    //     return o.duration <= maxDuration && !o.isLive
    // })

    if (videos.length === 0 && unfilteredVideos.length) {
        console.log(`>> None of the ${unfilteredVideos.length} Tracks are ${prettyMS(maxDuration, {verbose:true})} or less long.`);
        unfilteredVideos.forEach(o => {
            console.log(kleur.gray(truncate_to_window(`  - [${prettyMS(o.duration)}] ~ ${o.title}`)));
        })
        console.log('');
    } else if (videos.length !== unfilteredVideos.length) {
        console.log(kleur.gray(`  - Only ${videos.length}/${unfilteredVideos.length} Tracks are ${prettyMS(maxDuration, {verbose:true})} or less long.`));
    }*/

    return videos
}

function stripAnsi(string) {
    if (typeof string !== 'string') {
        throw new TypeError(`Expected a \`string\`, got \`${typeof string}\``);
    }

    return string.replace(ansiRegex(), '');
}

function ansiRegex({ onlyFirst = false } = {}) {
    const pattern = [
        '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
        '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))'
    ].join('|');

    return new RegExp(pattern, onlyFirst ? undefined : 'g');
}



module.exports = {
    truncate_to_window,
    random_str,
    duration_to_s,
    duration_to_ms,
    stripAnsi,
    duration_filter,
    strip_non_ascii
}