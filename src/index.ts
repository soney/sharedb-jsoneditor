/**
 * sharedb-json-editor
 * ShareDB bindings for json-editor
 * 
 * WARNING: ONLY USING SIMPLE FULL JSON REPLACEMENT FOR TESTING PURPOSES
 * THIS LIBRARY IS "TODO"
 * 
 * @name index.ts
 * @author Steve Oney <soney@umich.edu>
 * @license MIT
 */

import * as ShareDB from 'sharedb/lib/client';
import JSONEditor from 'jsoneditor'

export interface ShareDBJSONEditorOptions {
    path?: string[];
    doc: ShareDB.Doc;
    editor: JSONEditor;
}

export default class ShareDBJSONEditorBinding {
    private listening: boolean = false;
    private suppress: boolean  = false;
    private oldJSONChangeFunction: Function;

    public constructor(private readonly opts: ShareDBJSONEditorOptions) {
        if(!opts.path) { opts.path = []; }

        this.listen();
        this.setInitialValue();
    }

    private getDoc(): ShareDB.Doc { return this.opts.doc; }
    private getEditor(): JSONEditor { return this.opts.editor; }
    private getPath(): string[] { return this.opts.path; }

    private setInitialValue(): void {
        const doc = this.getDoc();
        const editor = this.getEditor();

        if(doc.type === null) {
            doc.fetch((err) => {
                if(err) {
                    throw err;
                } else {
                    this.setInitialValue();
                }
            });
            this.suppress = true;
            editor.set({});
            this.suppress = false;
        } else {
            const editor = this.getEditor();
            this.suppress = true;
            editor.set(this.navigate(doc.data, this.getPath()));
            this.suppress = false;
        }
    }

    private navigate(data: any, path: string[]): any {
        const len = path.length;
        let currentObject = data;
        for(let i: number = 0; i<len; i++) {
            currentObject = currentObject[path[i]];
        }
        return currentObject;
    }

    public listen(): void {
        if(!this.listening) {
            this.listening = true;

            const doc = this.getDoc();
            doc.on('op', this.$onRemoteChange);

            const editor = this.getEditor();
            this.oldJSONChangeFunction = (editor as any).options.onChangeJSON;
            (editor as any).options.onChangeJSON = this.$onLocalChange;
        }
    }

    public unlisten(): void {
        if(this.listening) {
            this.listening = false;

            const doc = this.getDoc();
            doc.off('op', this.$onRemoteChange);

            const editor = this.getEditor();
            (editor as any).options.onChangeJSON = this.oldJSONChangeFunction;
        }
    }

    private $onRemoteChange = (ops: ShareDB.Op[], source: boolean, sourceID?: string) => {
        if(this.suppress) { return; }

        const doc = this.getDoc();
        const newValue = this.navigate(doc.data, this.getPath());
        const editor = this.getEditor();
        editor.set(newValue);
    };

    private $onLocalChange = (newValue: any) => {
        if(this.oldJSONChangeFunction) {
            this.oldJSONChangeFunction(newValue);
        }

        this.suppress = true;
        const doc = this.getDoc();
        doc.submitOp([{p: [...this.getPath()], oi: newValue }]);
        this.suppress = false;
    };
}