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

interface JSONEditorNode {
    fieldEditable: boolean;
    field: string|undefined;
    childs?: JSONEditorNode[];
    editor: JSONEditor;
    parent: JSONEditorNode|null;
    updateValue: Function;
}

type ActionPath = number[];
interface Selection {
    domName: 'value',
    path: ActionPath,
    paths: null,
    range: {
        startOffset: number,
        endOffset: number
    },
    scrollTop: number
}

interface HistoryAction {
    action: string,
    timestamp: Date,
    params: {
        [key: string]: any
    }
}

interface InsertBeforeNodesAction extends HistoryAction {
    action: 'insertBeforeNodes',
    params: {
        paths: ActionPath[],
        parentPath: ActionPath,
        oldSelection: Selection,
        newSelection: Selection,
        nodes: JSONEditorNode[],
        beforePath: ActionPath
    }
}

interface MoveNodesAction extends HistoryAction {
    action: 'moveNodes',
    params: {
        count: number,
        fieldNames: string[],
        newIndex: number|null,
        newIndexRedo: number|null,
        newParentPath: ActionPath,
        newParentPathRedo: ActionPath|null,
        newSelection: Selection,
        oldSelection: Selection,
        oldIndex: number|null,
        oldIndexRedo: number|null,
        oldParentPath: ActionPath,
        oldParentPathRedo: ActionPath
    }
}

type objectType = 'object'|'auto'|'string'|'array';

interface SortAction extends HistoryAction {
    action: 'sort',
    params: {
        path: ActionPath,
        newChilds: JSONEditorNode[],
        oldChilds: JSONEditorNode[]
    }
}
interface TransformAction extends HistoryAction {
    action: 'transform',
    params: {
        newValue: any,
        oldValue: any
    }
}
interface DuplicateNodesAction extends HistoryAction {
    action: 'duplicateNodes',
    params: {
        afterPath: ActionPath,
        clonePaths: ActionPath[],
        parentPath: ActionPath,
        paths: ActionPath[],
        oldSelection: Selection,
        newSelection: Selection
    }
}
interface ChangeTypeAction extends HistoryAction {
    action: 'changeType',
    params: {
        newType: objectType,
        oldType: objectType,
        path: ActionPath,
        oldSelection: Selection,
        newSelection: Selection
    }
}

interface EditFieldAction extends HistoryAction {
    action: 'editField',
    params: {
        index: number,
        paths: ActionPath[],
        parentPath: ActionPath,
        oldSelection: Selection,
        newSelection: Selection,
        nodes: JSONEditorNode[],
        newValue: any,
        oldValue: any
    }
}

interface AppendNodesAction extends HistoryAction {
    action: 'appendNodes',
    params: {
        paths: ActionPath[],
        parentPath: ActionPath,
        oldSelection: Selection,
        newSelection: Selection,
        nodes: JSONEditorNode[],
    }
}

interface EditHistoryAction extends HistoryAction {
    action: 'editValue',
    params: {
        path: ActionPath,
        oldSelection: Selection,
        newSelection: Selection,
        oldValue: any,
        newValue: any
    }
}

interface RemoveNodesAction extends HistoryAction {
    action: 'removeNode',
    params: {
        index: number
        parentPath: ActionPath,
        paths: ActionPath[],
        nodes: JSONEditorNode[],
        oldSelection: Selection,
        newSelection: Selection,
    }
}

interface EditorHistory {
    onChange: ()=>void;
    index: number,
    history: HistoryAction[]
}

export default class ShareDBJSONEditorBinding {
    private readonly history: EditorHistory;
    private previousHistoryIndex: number
    private listening: boolean = false;
    private suppress: boolean  = false;
    private oldJSONChangeFunction: Function;

    public constructor(private readonly opts: ShareDBJSONEditorOptions) {
        if(!opts.path) { opts.path = []; }
        this.history = (this.getEditor() as any).history;
        this.previousHistoryIndex = this.history.index

        this.listen();
        this.setInitialValue();
        (window as any).editor = this.getEditor();
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
            doc.subscribe((err) => {
                if(err) {
                    throw err;
                } else {
                    this.setInitialValue();
                }
            });
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
        const rootNode = (editor as any).node as JSONEditorNode;

        ops.forEach((op) => {
            const { p } = op;
            const fullPath = [...this.getPath(), ...p];
            if(op.hasOwnProperty('oi')) {
                const { oi } = op as ShareDB.ObjectInsertOp;
                const node = ShareDBJSONEditorBinding.getNode(fullPath, rootNode);
                // const nodeEditor = node.editor;
                // nodeEditor.set(oi);
                // console.log(node)
                node.updateValue(oi);
            }
        });

        // editor.set(newValue);
    };

    private static getNode(path: (string|number)[], node: JSONEditorNode): JSONEditorNode|null {
        if(path.length === 0) {
            return node;
        } else {
            const currentPathItem = path[0];
            const childNodes = node.childs;
            for(let i: number = 0; i<childNodes.length; i++) {
                const childNode = childNodes[i];
                if(childNode.field === currentPathItem) {
                    return this.getNode(path.slice(1), childNode);
                }
            }
            return null;
        }
    }

    private static getShareDBPath(jsonEditorPath: number[], rootNode: JSONEditorNode): (string|number)[] {
        const shareDBPath = []
        let node = rootNode;
        jsonEditorPath.forEach((idx) => {
            node = node.childs[idx];
            shareDBPath.push(node.field);
        });
        return shareDBPath;
    }

    private $onLocalChange = (newValue: any) => {
        this.suppress = true;

        if(this.oldJSONChangeFunction) {
            this.oldJSONChangeFunction(newValue);
        }
        const newHistoryIndex = this.history.index;
        const doc = this.getDoc();
        if(newHistoryIndex === this.previousHistoryIndex+1) {
            const actions = this.history.history;
            const last = actions[actions.length - 1];
            const {action} = last;

            if(action === 'editValue') {
                const lastAction = last as EditHistoryAction;
                const {path, newValue} = lastAction.params;
                const editor = this.getEditor();
                const rootNode = (editor as any).node as JSONEditorNode;
                const shareDBPath = [...this.getPath(), ...ShareDBJSONEditorBinding.getShareDBPath(path, rootNode)];

                doc.submitOp([{p: shareDBPath, oi: newValue }]);
            } else if(action === 'removeNodes') {
                const lastAction = last as RemoveNodesAction;
                const {paths, index} = lastAction.params;

                const editor = this.getEditor();
                const rootNode = (editor as any).node as JSONEditorNode;
                const shareDBPaths = paths.map((path) => [...this.getPath(), ...ShareDBJSONEditorBinding.getShareDBPath(path, rootNode)]);

                // const ops = doc.submitOp(shareDBPaths.map((path) => [{
                //     p: path, od: 
                // }]));
                console.log(lastAction)
            } else if(action === 'appendNodes') {
                const lastAction = last as AppendNodesAction;
                const {paths} = lastAction.params;
                console.log(lastAction)
            } else if(action === 'editField') {
                const lastAction = last as EditFieldAction;
                const {paths} = lastAction.params;
                console.log(lastAction)
            } else {
                console.log(last);
                doc.submitOp([{p: [...this.getPath()], oi: newValue }]);
            }

            this.previousHistoryIndex = newHistoryIndex;
        } else {
            doc.submitOp([{p: [...this.getPath()], oi: newValue }]);
        }

        this.suppress = false;
    };
}