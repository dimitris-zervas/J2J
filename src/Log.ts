export default class Log {

    public prefix: string = '';

    constructor(prefix: string) {
        this.prefix = prefix;
    }

    info(msg: string): void {
        console.log(`${this.prefix}:> ${msg}`);
    }

}
