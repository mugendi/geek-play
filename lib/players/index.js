const fg = require('fast-glob'),
    path = require('upath');

let k, players = fg.sync(path.join(__dirname, '*.js')).filter(s => !/index\.js$/.test(s))
    .map(f => {
        k = path.basename(f).replace('.js', '');
        return {
            [k]: require(f)
        }
    }).reduce((a, b) => Object.assign(a, b), {})


module.exports = players