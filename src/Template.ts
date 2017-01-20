/// <reference path="../typings/index.d.ts" />
//import {BeSkill} from '@be/be-framework';
import BaseSkill from './BaseSkill';
import jibo = require('jibo');

let mainBt:any;// = require('./behaviors/main');
let mainFlow:any = require('./flows/main');

export class Template extends BaseSkill {

    public bt:any;
    public flow:any;
    /**
     * Template skill constructor
     * @constructor
     * @param {String} [assetPack=''] The asset pack if loading from Be
     */
    constructor(assetPack?:string) {

        super(assetPack);
        this.bt = null;
        this.flow = null;
    }

    preload(done:(err?:any)=>void):void {
        // //set up embodied speech plugin for this skill
        // BeSkill.plugins.embodiedSpeech.installDelegate(this.assetPack);
        done();
    }

    /**
     * Start the skill
     * @method open
     */
    open(result?:any):void {
        const options = { assetPack: this.assetPack };

        if (mainBt) {
          this.bt = jibo.bt.run(mainBt, options, () => {
              this.exit();
            });
        }

        if (mainFlow) {
          this.flow = jibo.flow.run(mainFlow, options, () => {
            this.exit();
          });
        }
    }

    /**
     * Stop and unload the skill
     * @method close
     */
    close(done:() => void):void {
        if (this.bt) {
            this.bt.destroy();
            this.bt = null;
        }
        done();
    }
}
