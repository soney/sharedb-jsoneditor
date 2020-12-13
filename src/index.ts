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
    index: number;
    fieldEditable: boolean;
    field: string|undefined;
    childs?: JSONEditorNode[];
    editor: JSONEditor;
    parent: JSONEditorNode|null;
    updateValue: Function;
    removeChild: (child: JSONEditorNode, updateDom: boolean) => void;
    appendChild: (child: JSONEditorNode, visible: boolean, updateDom: boolean) => void;
    getValue: () => any;
    constructor: any;
    // (editor: any, params: any) => JSONEditorNode;
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
        parentPath: ActionPath,
        oldSelection: Selection,
        newSelection: Selection,
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
            editor.expandAll() // TODO: remove
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
        const rootNode = this.getEditorRootNode();

        ops.forEach((op) => {
            console.log(op);
            const { p } = op;
            const fullPath = ShareDBJSONEditorBinding.removePrefix(this.getPath(), p);

            if(op.hasOwnProperty('od')) {
                // const { od } = op as ShareDB.ObjectDeleteOp;
                const node = ShareDBJSONEditorBinding.getNode(fullPath, rootNode);
                const parentNode = node.parent;
                parentNode.removeChild(node, true);
            }

            if(op.hasOwnProperty('oi')) {
                const { oi } = op as ShareDB.ObjectInsertOp;
                const node = ShareDBJSONEditorBinding.getNode(fullPath, rootNode);
                if(node) {
                    node.updateValue(oi);
                } else {
                    const parentNode = ShareDBJSONEditorBinding.getNode(fullPath.slice(0, fullPath.length - 1), rootNode);
                    const node = new parentNode.constructor(parentNode.editor, {
                        field: fullPath[fullPath.length-1],
                        value: oi
                    });
                    parentNode.appendChild(node, true, true)
                }
            }

            if(op.hasOwnProperty('ld')) {
                // const { ld } = op as ShareDB.ListDeleteOp;
                const node = ShareDBJSONEditorBinding.getNode(fullPath, rootNode);
                const parentNode = node.parent;
                parentNode.removeChild(node, true);
            }

            if(op.hasOwnProperty('li')) {
                const { li } = op as ShareDB.ListInsertOp;
                const node = ShareDBJSONEditorBinding.getNode(fullPath, rootNode);
                if(node) {
                    node.updateValue(li);
                } else {
                    const parentNode = ShareDBJSONEditorBinding.getNode(fullPath.slice(0, fullPath.length - 1), rootNode);
                    const node = new parentNode.constructor(parentNode.editor, {
                        field: fullPath[fullPath.length-1],
                        value: li
                    });
                    parentNode.appendChild(node, true, true)
                }
                // const parentNode = node.parent;
                // parentNode.removeChild(node, true);
            }

            if(op.hasOwnProperty('na')) {
                const { na } = op as ShareDB.AddNumOp;
                const currentValue = ShareDBJSONEditorBinding.traverseData(doc.data, p);
                const node = ShareDBJSONEditorBinding.getNode(fullPath, rootNode);
                if(node) {
                    node.updateValue(currentValue);
                }
            }
        });
    };

    private static getNode(path: (string|number)[], node: JSONEditorNode): JSONEditorNode|null {
        if(path.length === 0) {
            return node;
        } else {
            const currentPathItem = path[0];
            const childNodes = node.childs;
            for(let i: number = 0; i<childNodes.length; i++) {
                const childNode = childNodes[i];
                if(childNode.field === currentPathItem || childNode.index === currentPathItem) {
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
            if(node.field) {
                shareDBPath.push(node.field);
            } else {
                shareDBPath.push(node.index);
            }
        });
        return shareDBPath;
    }
    
    private static traverseData(data: any, path: ShareDB.Path): any {
        let result: any = data;
        for(let i: number = 0; i<path.length; i++) {
            result = result[path[i]];
        }
        return result;
    }

    private $onLocalChange = (newValue: any) => {
        this.suppress = true;

        if(this.oldJSONChangeFunction) {
            this.oldJSONChangeFunction(newValue);
        }
        const newHistoryIndex = this.history.index;
        const doc = this.getDoc();
        const movingForward = newHistoryIndex === this.previousHistoryIndex+1;
        const movingBackward = newHistoryIndex === this.previousHistoryIndex-1;
        this.previousHistoryIndex = newHistoryIndex;

        if(movingForward || movingBackward) {
            const actions = this.history.history;
            const currentAction = actions[movingBackward ? newHistoryIndex+1 : newHistoryIndex];
            const {action} = currentAction;

            if(action === 'editValue') {
                const ops = this.getEditActionOp(currentAction as EditHistoryAction, movingBackward);
                doc.submitOp(ops);
            } else if(action === 'editField') {
                const ops = this.getEditFieldOp(currentAction as EditFieldAction, movingBackward);
                doc.submitOp(ops);
            } else if(action === 'removeNodes') {
                const ops = this.getRemoveNodeOp(currentAction as RemoveNodesAction, movingBackward);
                doc.submitOp(ops);
            } else if(action === 'moveNodes') {
                const ops = this.getMoveNodesOp(currentAction as MoveNodesAction, movingBackward);
                doc.submitOp(ops);
            } else {
                doc.submitOp([{p: [...this.getPath()], oi: newValue }]);
            }
        } else {
            doc.submitOp([{p: [...this.getPath()], oi: newValue }]);
        }

        this.suppress = false;
    };
    private getEditFieldOp(action: EditFieldAction, undo: boolean): ShareDB.Op[] {
        const {parentPath, oldValue, newValue} = action.params;
        const currentValue = undo ? oldValue : newValue;
        const previousValue = undo ? newValue : oldValue;
        const shareDBParentPath = [...this.getPath(), ...ShareDBJSONEditorBinding.getShareDBPath(parentPath, this.getEditorRootNode())];
        const doc = this.getDoc();
        const obj = ShareDBJSONEditorBinding.traverseData(doc.data, [...shareDBParentPath, previousValue]);
        return [
            {p: [...shareDBParentPath, previousValue], od: obj },
            {p: [...shareDBParentPath, currentValue], oi: obj}
        ];
    }
    private getEditActionOp(action: EditHistoryAction, undo: boolean): ShareDB.Op[] {
        const {path, newValue, oldValue} = action.params;
        const currentValue = undo ? oldValue : newValue;
        const shareDBPath = [...this.getPath(), ...ShareDBJSONEditorBinding.getShareDBPath(path, this.getEditorRootNode())];
        return [ {p: shareDBPath, oi: currentValue } ];
    }
    private getRemoveNodeOp(action: RemoveNodesAction, undo: boolean): ShareDB.Op[] {
        const {index, nodes, parentPath, paths} = action.params;
        const shareDBParentPath = [...this.getPath(), ...ShareDBJSONEditorBinding.getShareDBPath(parentPath, this.getEditorRootNode())];

        if(undo) {
            return nodes.map((node) => {
                const field = node.field;
                const value = node.getValue();
                if(field) {
                    const p = [...shareDBParentPath, field];
                    return {p, oi: value };
                } else {
                    const index = node.index;
                    const p = [...shareDBParentPath, index];
                    return {p, li: value };
                }
            });
        } else {
            const doc = this.getDoc();
            return nodes.map((node) => {
                const field = node.field;
                if(field) {
                    const p = [...shareDBParentPath, field];
                    const value = ShareDBJSONEditorBinding.traverseData(doc.data, [...shareDBParentPath, field]);
                    return {p, od: value };
                } else {
                    const index = node.index;
                    const p = [...shareDBParentPath, index];
                    const value = ShareDBJSONEditorBinding.traverseData(doc.data, [...shareDBParentPath, index]);
                    return {p, ld: value };
                }
            });
        }
        // const shareDBPaths = paths.map((path) => [...this.getPath(), ...ShareDBJSONEditorBinding.getShareDBPath(path, this.getEditorRootNode())]);
        // console.log(index, nodes, parentPath, paths);
        // console.log(shareDBParentPath);
        // console.log(nodes);
        // return [];
    }
    private getMoveNodesOp(action: MoveNodesAction, undo: boolean): ShareDB.Op[] {
        console.log(action);
        return [];
    }

    private getEditorRootNode(): JSONEditorNode {
        return (this.getEditor() as any).node as JSONEditorNode;
    }

    private static removePrefix(prefix: ShareDB.Path, path: ShareDB.Path) {
        return path.slice(prefix.length);
    }
}