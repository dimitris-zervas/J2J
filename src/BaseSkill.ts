import {EventEmitter} from 'events';
import jibo = require('jibo');
import Log from './Log';

/**
 * @description Options interface
 * @interface BaseSkill~Options
 * @prop {string} [assetPack] Asset pack name
 * @prop {string} [rootPath] Path to the aset pack
 */
export interface Options {
    assetPack?:string;
    rootPath?:string;
}

/**
 * @description Skill exit method payload
 * @interface BaseSkill~ExitOptions
 * @prop {boolean} [noElementsOfSurprise] If true then we bypass Elements of Surprise
 * @prop {boolean} [globalNoMatch] If true then we go directly to Idle which will
 * respond with its globalNoMatch logic
 */
export interface ExitOptions {
    noElementsOfSurprise?: boolean;
    globalNoMatch?: boolean;
}

/**
 * Callback for async events
 * @callback BaseSkill~AsyncCallback
 * @param {Error|String} [err] Error, if one occurs.
 */
export type AsyncCallback = (err?:Error|string) => void;

/**
 * A generator callback function providing both `resolve` and `reject` functions
 * @callback BaseSkill~PromiseGenerator
 * @param {Function} resolve
 * @param {Function} reject
 */
export type PromiseGenerator = (resolve: (ret?:any) => void, reject: (err?:any) => void) => void;

/**
 * A function that gets called when switching skills.
 * @callback BaseSkill~PreSkillHook
 * @param {string} oldSkill Name of current skill
 * @param {string} newSkill Name of new skill
 * @param {object} results ASR results (might be empty)
 * @returns {Function} PromiseGenerator
 */
export type OpenHook = (oldSkill:string, newSkill: string, results: any) => PromiseGenerator;

/**
 * Base class for skill running inside of Be
 * @class BaseSkill
 * @extends EventEmitter
 * @param {Object} [options] Be options for setting up this skill or the assetPack name.
 * @param {String} [options.assetPack=''] Name of the asset pack if running in the context of another skill.
 * @param {String} [options.rootPath=''] The path to this skill's root folder.
 */
class BaseSkill extends EventEmitter {

    /**
     * Current version of the library.
     * @name BaseSkill.version
     * @type {String}
     */
    public static version:string = '/* @echo VERSION */';


    /**
     * Asset pack name for this skill, if running within Be. Otherwise, this is empty.
     * @name BaseSkill#assetPack
     * @type {String}
     */
    public assetPack:string;

    /**
     * Root path for skill.
     * @name BaseSkill#rootPath
     * @type {String}
     */
    public rootPath:string;

    /**
     * Log instance for skill.
     * @name BaseSkill#log
     * @type {Object}
     */
    public log:Log;

    /**
     * Keep track of whether the skill has opened once
     * @name BaseSkill#_opened
     * @type {boolean}
     * @private
     */
    private _opened:boolean = false;

    /**
     * Called from Be, and in standalone, before opening any skill.
     * Performs any asynchronous cleanup or preparation.
     * Don't confuse with the instance method `open([result])`.
     * @method BaseSkill.open
     * @param {String} lastSkill Name of skill that is stopping (null if no skill is stopping)
     * @param {String} nextSkill Name of skill that is about to open
     * @param {object} results - launch intent: the ASR results for the launch
     * command, usually, but could also be empty or contain launch options from another source
     *
     * @param {Function} done Callback to call when done
     */
    public static open(lastSkill: string, nextSkill: string, results: any, done:AsyncCallback) {
        done();
    }

    /**
     * STATIC Use to statically initialize resources for all BaseSkills.
     * Don't confuse with `init()`
     * @method BaseSkill.init
     * @param {Function} done Callback when complete
     * @static
     */
    public static init(done:AsyncCallback): void {
        done();
    };

    constructor(options?:Options) {

        super();

        // Backward compatibility where options is assetPack
        if (typeof options === 'string') {
            options = {
                assetPack: <string>options
            };
        }

        // Set default options
        options = (<any>Object).assign({
            assetPack: '',
            rootPath: jibo.utils.PathUtils.findRoot()
        }, options || {});

        // Set instance properties
        this.rootPath = options.rootPath;
        this.assetPack = options.assetPack;

        // Initalize the skill's log instance;
        // the log prefix should be assetPack ID
        let logPrefix = this.assetPack;
        if (!logPrefix) {
            // if running stand-alone, then use project name for prefix
            logPrefix = jibo.utils.PathUtils.getProjectName(this.rootPath);
        }
        this.log = new Log(logPrefix);
        this.log.info("Initializing...");

        // Run in standalone mode
        if (!this.assetPack) {

            // Initialize jibo and the BaseSkill plugins
            this.init();
        }
    }

    /**
     * Initialize the eye in standalone mode.
     * If you don’t pass in an asset pack, this method will automatically start (call `open`) on your skill.
     * Don't confuse with `init(done)`
     * @method BaseSkill#init
     */
    init() {

        jibo.init('face', (err?:Error) => {
            if (err) {
                return console.error(err);
            }

            // Handle internal exits
            this.on('exit', this.close.bind(this, ():void => {
              // do nothing
            }));

            BaseSkill.init((err) => {
                if (err) {
                    return console.error(err);
                }
                // Do a post-init hook
                this.postInit((err) => {
                    if (err) {
                        return console.error(err);
                    }
                    // Run any BaseSkill open hooks
                    BaseSkill.open(null, this.assetPack, {}, (err) => {
                        if (err) {
                            return console.error(err);
                        }
                        // Do a pre-open hook
                        this.preload((err) => {
                            if (err) {
                                return console.error(err);
                            }

                            // Handle refresh to the same app
                            jibo.gl.on('relaunch', (result)=>{
                                if(this._opened) {
                                    this.refresh(result);
                                } else {
                                    this._opened = true;
                                    this.open(result);
                                }
                            });

                            //open with a null opening intent - skills will have to handle that
                            //however they need to, if it is quitting, running a question mim, or
                            //something else
                            this._opened = true;
                            this.open();
                        });
                    });
                });
            });
        });
    }

    /**
     * Overrideable async hook that happens once, upon construction after jibo has initialized.
     * @method BaseSkill#postInit
     * @param {Function} done Callback, first argument is an optional error.
     */
    postInit(done:AsyncCallback):void {
        done();
    }

    /**
     * Overrideable async hook that happens everytime before the skill is opened. This does
     * not fire before each refresh.
     * @method BaseSkill#preload
     * @param {Function} done Callback, first argument is an optional error.
     */
    preload(done:AsyncCallback):void {
        done();
    }

    /**
     * Open a skill, must override.
     * Don't confuse with the BaseSkill static class method `open(lastSkill, nextSkill, results, done)`.
     * @method BaseSkill#open
     * @param {Object} [result] launch intent: the parse object from the launch
     * command, usually, but could also be empty or contain launch options from another source
     */
    open(result?:any):void {
        // @if DEBUG
        console.warn('Must override BaseSkill.open');
        // @endif
    }

    /**
     * Trigger a refresh
     * @method BaseSkill#refresh
     * @param {Object} [result] Parse object from `jibo.gl`
     */
    refresh(result?:any) {
        this.open(result);
    }

    /**
     * Unload a skill, must override
     * @method BaseSkill#close
     * @param {Function} done Callback to call when completed.
     */
    close(done:AsyncCallback) {
        // @if DEBUG
        console.warn('Must override BaseSkill.close');
        // @endif
    }

    /**
     * Exit the application. Called internally when the skill is done.
     * @param {ExitOptions} exitOptions Optional exit options for skill.
     * @method BaseSkill#exit
     */
    exit(exitOptions?:ExitOptions) {
        // Done with this
        this.emit('exit', exitOptions);
    }

    /**
     * Redirect to another internal Be skill
     * @method BaseSkill#redirect
     * @param {String} skillName E.g. "weather"
     * @param {Object} [options] Additional options for redirect
     */
    redirect(skillName, options) {

        this.emit('redirect', `@be/${skillName}`, options);
    }

    /**
     * Destroy this skill.  This should *probably* only be called from the Be superskill.
     * The intent for this method is to un-allocate / restore state change from the skill constructor or skill init sequence
     * @method BaseSkill#destroy
     * @param {Function(String)} done Callback to call when completed.  Assumes an argument of a string error parameter or null
     */
    destroy(done) {
        done(null);
    }
}

export default BaseSkill;
