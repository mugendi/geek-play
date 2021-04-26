// only load for windows
let ntsuspend;

if (isWindows()) {
    ntsuspend = require('./ntsuspend');
}



function suspend(process, updateIsSuspended) {
    if (isWindows()) {
        ntsuspend.suspend(process.pid);

    } else {
        process.kill('SIGSTOP');
    }
    // indicate that process is suspended
    if (updateIsSuspended) process.isSuspended = true;
}

function resume(process, updateIsSuspended) {
    if (isWindows()) {
        ntsuspend.resume(process.pid);
    } else {
        process.kill('SIGCONT');
    }
    // indicate that process is not suspended
    if (updateIsSuspended) process.isSuspended = false;
}

function bind(process) {
    process.suspend = () => suspend(process, true)
    process.resume = () => resume(process, true)
    process.isSuspended = false;
}


function isWindows() {
    return process && (process.platform === 'win32' || /^(msys|cygwin)$/.test(process.env.OSTYPE));
};

module.exports = { bind, suspend, resume }