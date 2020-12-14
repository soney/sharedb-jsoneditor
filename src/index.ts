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

import { ShareDBJSONEditorBinding } from './sharedb-jsoneditor-binding';
import * as ShareDB from 'sharedb/lib/client';
import JSONEditor, { JSONEditorOptions } from 'jsoneditor';
import extend from 'lodash/extend';

export default class ShareDBJSONEditor {
    private readonly editor: JSONEditor;
    private readonly binding: ShareDBJSONEditorBinding;
    public constructor(private readonly doc: ShareDB.Doc, readonly container:HTMLElement, readonly path: ShareDB.Path=[], readonly jsonEditorOptions?: JSONEditorOptions) {
        this.editor = new JSONEditor(container, extend({
            history: true,
            mode: 'tree',
            name: this.path.length > 0 ? this.path[this.path.length-1] : undefined,
            mainMenuBar: false,
            limitDragging: true
        }, jsonEditorOptions));
        (window as any).editor = this.editor;
        this.binding = new ShareDBJSONEditorBinding({ editor: this.editor, doc: this.doc, path: this.path });
    }

    public unlisten(): void { this.binding.unlisten(); }
    public listen(): void { this.binding.listen(); }
    public destroy(): void {
        this.unlisten();
        this.editor.destroy();
    }
}