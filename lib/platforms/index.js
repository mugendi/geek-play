/*-------------------------------------------------------------------------------------------------------------------
    Modules
//-------------------------------------------------------------------------------------------------------------------*/
const fs = require('fs-extra'),
    path = require('upath'),
    fg = require('fast-glob');

// 
let platformActions = {},
    platform,
    action,
    pat = path.join(__dirname, '*/*.js'),
    mods = fg.sync([pat]).map(f => {
        action = path.basename(f).replace('.js', '')
        platform = path.basename(path.dirname(f));

        platformActions[platform] = platformActions[platform] || {};
        platformActions[platform][action] = require(f);
    })




module.exports = platformActions;