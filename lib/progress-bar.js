const logUpdate = require('log-update'),
    numbro = require('numbro');

class ProgressBar {

    constructor(opts) {
        this.opts = Object.assign({
            progressBar: '■',
            size: process.stdout.columns - (' [100.00%] '.length),
            mantissa: 2
        }, opts);
    }

    show(pc) {
        logUpdate(
            `[` +
            this.opts.progressBar.repeat(this.opts.size * pc).padEnd(this.opts.size) +
            numbro(pc).format({ output: "percent", mantissa: this.opts.mantissa }) +
            `]`
        );

        if (pc == 1) {
            logUpdate.done()
        }
    }

    simulate(duration, opts) {

        this.opts = Object.assign(this.opts, opts)

        let max = 100,
            val = 0,
            ticker = duration / max,
            interval, pc;

        interval = setInterval(() => {
            val++;
            pc = val / max;
            this.show(pc);
            if (val >= max) clearInterval(interval);
        }, ticker);

    }

}


module.exports = ProgressBar