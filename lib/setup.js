const which = require('which'),
    Conf = require('conf'),
    config = new Conf(),
    os = require('os'),
    platform = os.platform();




function get_binary_url() {


    const platforms = {
            mac: () => platform === 'darwin',
            linux: () => platform === 'linux',
            win: () => platform === 'win32'
        },
        archs = {
            x64: () => process.arch === 'x64',
            arm: () => process.arch === 'arm',
            ia32: () => process.arch === 'ia32'
        }

    // https://ffbinaries.com/downloads
    let ffplayBinaries = {
        'win:x32': 'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v4.2.1/ffplay-4.2.1-win-32.zip',
        'win:x64': 'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v4.2.1/ffplay-4.2.1-win-64.zip',

        'linux:x32': 'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v3.2/ffplay-3.2.2-linux-32.zip',
        'linux:x64': 'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v3.2/ffplay-3.2.2-linux-64.zip',

        'mac:x64': 'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v4.2.1/ffplay-4.2.1-osx-64.zip'
    }

    let binaryKey = '';
    for (let k in platforms) {
        if (platforms[k]()) {
            binaryKey = k;
        }
    }
    for (let k in archs) {
        if (archs[k]()) {
            binaryKey = binaryKey + ':' + k;
        }
    }

    // get the binary url
    return ffplayBinaries[binaryKey];
}


async function download_ffplay() {

    let ffplayPath = await which('ffplay').catch(err => null);

    console.log({ ffplayPath });

    // if no path
    if (!ffplayPath) {
        /*-------------------------------------------------------------------------------------------------------------------
            Prepare for download
        //-------------------------------------------------------------------------------------------------------------------*/
        const path = require('path'),
            fs = require('fs-extra'),
            download = require('download'),
            ProgressBar = require('../lib/progress-bar'),
            progressBar = new ProgressBar();


        let dir = path.join(__dirname, '../', 'ffplay', platform);


        let ffPlayBinaryURL = get_binary_url();
        let ffplayFile = (fs.pathExistsSync(dir)) ? fs.readdirSync(dir).filter(f => /ffplay/.test(f)).shift() : null;

        if (ffplayFile) {
            // set in config
            config.set('ffplay-path', path.join(dir, ffplayFile))
            return
        }



        if (ffPlayBinaryURL) {
            console.log(`>> GeekPlay Uses FFPlay to playback your media. However, it is missing.`);
            console.log(`>> But fear not. We will set it up for you real quick...`);
            console.log(`>> Downloading ffplay...`);


            fs.ensureDir(dir);

            await download(ffPlayBinaryURL, dir, { extract: true })
                .on('downloadProgress', function(progress) {
                    progressBar.show(progress.percent)
                })
                .on('end', function() {
                    // get path of extracted
                    ffplayFile = fs.readdirSync(path.join(dir)).filter(f => /ffplay/.test(f)).shift()
                    if (ffplayFile) {
                        config.set('ffplay-path', path.join(dir, ffplayFile))
                    }
                })


        } else {
            throw new Error(`This module uses FFPLAY from FFMEG. Please install FFPLAY! `)

        }


    } else {
        config.set('ffplay-path', ffplayPath)
    }

}

module.exports = { download_ffplay }