
import * as ShareDB from 'sharedb/lib/client';
import {flatten, isEqual} from 'lodash';
import JSONEditor from 'jsoneditor'

export interface ShareDBJSONEditorOptions {
    path?: ShareDB.Path;
    doc: ShareDB.Doc;
    editor: JSONEditor;
}

export class ShareDBJSONEditorBinding {
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
    private getPath(): ShareDB.Path { return this.opts.path; }

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

    private navigate(data: any, path: ShareDB.Path): any {
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

        const editor = this.getEditor();
        editor.update(doc.data);

        // ops.forEach((op) => {
        //     console.log(op);
        //     const { p } = op;
        //     const fullPath = ShareDBJSONEditorBinding.removePrefix(this.getPath(), p);

        //     if(op.hasOwnProperty('od')) {
        //         // const { od } = op as ShareDB.ObjectDeleteOp;
        //         const node = ShareDBJSONEditorBinding.getNode(fullPath, rootNode);
        //         const parentNode = node.parent;
        //         parentNode.removeChild(node, true);
        //     }

        //     if(op.hasOwnProperty('oi')) {
        //         const { oi } = op as ShareDB.ObjectInsertOp;
        //         const node = ShareDBJSONEditorBinding.getNode(fullPath, rootNode);
        //         if(node) {
        //             node.updateValue(oi);
        //         } else {
        //             const parentNode = ShareDBJSONEditorBinding.getNode(fullPath.slice(0, fullPath.length - 1), rootNode);
        //             const node = new parentNode.constructor(parentNode.editor, {
        //                 field: fullPath[fullPath.length-1],
        //                 value: oi
        //             });
        //             parentNode.appendChild(node, true, true)
        //         }
        //     }

        //     if(op.hasOwnProperty('ld')) {
        //         // const { ld } = op as ShareDB.ListDeleteOp;
        //         const node = ShareDBJSONEditorBinding.getNode(fullPath, rootNode);
        //         const parentNode = node.parent;
        //         parentNode.removeChild(node, true);
        //     }

        //     if(op.hasOwnProperty('li')) {
        //         const { li } = op as ShareDB.ListInsertOp;
        //         const node = ShareDBJSONEditorBinding.getNode(fullPath, rootNode);
        //         if(node) {
        //             node.updateValue(li);
        //         } else {
        //             const parentNode = ShareDBJSONEditorBinding.getNode(fullPath.slice(0, fullPath.length - 1), rootNode);
        //             const node = new parentNode.constructor(parentNode.editor, {
        //                 field: fullPath[fullPath.length-1],
        //                 value: li
        //             });
        //             parentNode.appendChild(node, true, true)
        //         }
        //         // const parentNode = node.parent;
        //         // parentNode.removeChild(node, true);
        //     }

        //     if(op.hasOwnProperty('lm')) {
        //         const { lm } = op as ShareDB.ListMoveOp;
        //         const node = ShareDBJSONEditorBinding.getNode(fullPath, rootNode);

        //         const parentNode = node.parent;
        //         const currentIndex = p[p.length-1];
        //         const newIndex = lm;

        //         console.log(newIndex, currentIndex);
        //         if(newIndex < currentIndex) {

        //         } else if (newIndex > currentIndex) {

        //         }

        //         // if(node) {
        //         //     node.updateValue(li);
        //         // } else {
        //         //     const parentNode = ShareDBJSONEditorBinding.getNode(fullPath.slice(0, fullPath.length - 1), rootNode);
        //         //     const node = new parentNode.constructor(parentNode.editor, {
        //         //         field: fullPath[fullPath.length-1],
        //         //         value: li
        //         //     });
        //         //     parentNode.appendChild(node, true, true)
        //         // }
        //         // const parentNode = node.parent;
        //         // parentNode.removeChild(node, true);
        //     }

        //     if(op.hasOwnProperty('na')) {
        //         // const { na } = op as ShareDB.AddNumOp;
        //         const currentValue = ShareDBJSONEditorBinding.traverseData(doc.data, p);
        //         const node = ShareDBJSONEditorBinding.getNode(fullPath, rootNode);
        //         if(node) {
        //             node.updateValue(currentValue);
        //         }
        //     }
        // });
    };

    private static getNode(path: (string|number)[], node: JSONEditorNode): JSONEditorNode|null {
        if(path.length === 0) {
            return node;
        } else {
            const currentPathItem = path[0];
            return this.getNode(path.slice(1), node.childs[currentPathItem]);
        }
    }

    private static getShareDBPath(jsonEditorPath: number[], rootNode: JSONEditorNode): (string|number)[] {
        const shareDBPath = []
        let node = rootNode;
        jsonEditorPath.forEach((idx) => {
            node = node.childs[idx];
            if(node.field) {
                shareDBPath.push(node.field);
            } else if(node.index !== undefined) {
                shareDBPath.push(node.index);
            } else {
                shareDBPath.push('');
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

            let ops: ShareDB.Op[] = [];
            if(action === 'editValue') {
                ops = this.getEditActionOp(currentAction as EditHistoryAction, movingBackward);
            } else if(action === 'editField') {
                ops = this.getEditFieldOp(currentAction as EditFieldAction, movingBackward);
            } else if(action === 'removeNodes') {
                ops = this.getRemoveNodeOp(currentAction as RemoveNodesAction, movingBackward);
            } else if(action === 'moveNodes') {
                ops = this.getMoveNodesOp(currentAction as MoveNodesAction, movingBackward);
            } else if(action === 'appendNodes') {
                ops = this.getAppendNodesOp(currentAction as AppendNodesAction, movingBackward);
            } else if(action === 'insertBeforeNodes') {
                ops = this.getInsertBeforeNodesOp(currentAction as InsertBeforeNodesAction, movingBackward);
            } else if(action === 'changeType') {
                ops = this.getChangeTypeOp(currentAction as ChangeTypeAction, movingBackward);
            } else {
                // console.log(action);
                ops = [{p: [...this.getPath()], oi: newValue }];
            }
            doc.submitOp(ops);
        } else {
            doc.submitOp([ { p: [...this.getPath()], oi: newValue } ]);
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
            { p: [...shareDBParentPath, previousValue], od: obj },
            { p: [...shareDBParentPath, currentValue],  oi: obj }
        ];
    }
    private getEditActionOp(action: EditHistoryAction, undo: boolean): ShareDB.Op[] {
        const {path, newValue, oldValue} = action.params;
        const currentValue = undo ? oldValue : newValue;
        const previousValue = undo ? newValue : oldValue;
        const shareDBPath = [...this.getPath(), ...ShareDBJSONEditorBinding.getShareDBPath(path, this.getEditorRootNode())];
        const doc = this.getDoc();
        const parentValue = ShareDBJSONEditorBinding.traverseData(doc.data, shareDBPath.slice(0, shareDBPath.length-1))
        if(parentValue instanceof Array) {
            return [ {p: shareDBPath, ld: previousValue, li: currentValue } ];
        } else {
            return [ {p: shareDBPath, oi: currentValue } ];
        }
    }
    private toSDBPath(editorPath: number[]): ShareDB.Path {
        return [...this.getPath(), ...ShareDBJSONEditorBinding.getShareDBPath(editorPath, this.getEditorRootNode())]
    }
    private getRemoveNodeOp(action: RemoveNodesAction, undo: boolean): ShareDB.Op[] {
        const {index, nodes, parentPath, paths} = action.params;
        const shareDBParentPath = this.toSDBPath(parentPath);

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
                    const value = ShareDBJSONEditorBinding.traverseData(doc.data, p);
                    return {p, od: value };
                } else {
                    const index = node.index;
                    const p = [...shareDBParentPath, index];
                    const value = ShareDBJSONEditorBinding.traverseData(doc.data, p);
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
    private getChangeTypeOp(action: ChangeTypeAction, undo: boolean): ShareDB.Op[] {
        const { path } = action.params;
        const shareDBPath = this.toSDBPath(path);
        const node = ShareDBJSONEditorBinding.getNode(path, this.getEditorRootNode());
        const doc = this.getDoc();
        const parentPath = shareDBPath.slice(0, shareDBPath.length-1);

        const parent = ShareDBJSONEditorBinding.traverseData(doc.data, parentPath);
        const newValue = node.getValue();
        const oldValue = ShareDBJSONEditorBinding.traverseData(doc.data, shareDBPath);

        if(parent instanceof Array) {
            return [ { p: shareDBPath, ld: oldValue, li: newValue } ];
        } else {
            return [ { p: shareDBPath, od: oldValue, oi: newValue } ];
        }
    }
    private getInsertBeforeNodesOp(action: InsertBeforeNodesAction, undo: boolean): ShareDB.Op[] {
        const { beforePath, paths, parentPath, nodes } = action.params;
        const shareDBParentPath = this.toSDBPath(parentPath);
        const doc = this.getDoc();
        const parentValue = ShareDBJSONEditorBinding.traverseData(doc.data, shareDBParentPath);
        const ops: ShareDB.Op[] = [];
        for(let i: number = 0; i<paths.length; i++) {
            const path = paths[i];
            const node = nodes[i];
            const shareDBPath = this.toSDBPath(path);
            const value = node.getValue();
            if(parentValue instanceof Array) {
                ops.push({p: shareDBPath, li: value });
            } else {
                ops.push({p: shareDBPath, oi: value });
            }
        }
        return ops;
    }

    private getAppendNodesOp(action: AppendNodesAction, undo: boolean): ShareDB.Op[] {
        const { paths, parentPath, nodes } = action.params;
        const shareDBParentPath = this.toSDBPath(parentPath);
        const doc = this.getDoc();
        const parentValue = ShareDBJSONEditorBinding.traverseData(doc.data, shareDBParentPath);
        const ops: ShareDB.Op[] = [];
        for(let i: number = 0; i<paths.length; i++) {
            const path = paths[i];
            const node = nodes[i];
            const shareDBPath = this.toSDBPath(path);
            const value = node.getValue();
            if(parentValue instanceof Array) {
                ops.push({p: shareDBPath, li: value });
            } else {
                ops.push({p: shareDBPath, oi: value });
            }
        }
        return ops;
    }

    private getMoveNodesOp(action: MoveNodesAction, undo: boolean): ShareDB.Op[] {
        const { oldParentPath, oldParentPathRedo, newParentPath, newParentPathRedo, oldIndex, oldIndexRedo, newIndex, newIndexRedo, fieldNames } = action.params;
        const prevParentPath = undo ? newParentPath: oldParentPath;
        const currParentPath = undo ? oldParentPath: newParentPath;
        const prevIndex = undo ? newIndex: oldIndexRedo;
        const currIndex = undo ? oldIndex: newIndex;

        if(isEqual(prevParentPath, newParentPath)) { // true move within the same parent
            const parentShareDBPath = [...this.getPath(), ...ShareDBJSONEditorBinding.getShareDBPath(currParentPath, this.getEditorRootNode())];

            const moveOps: ShareDB.ListMoveOp[] = [];
            fieldNames.forEach((field) => {
                if(!field) { // no order for object keys in sharedb
                    moveOps.push({ p: [...parentShareDBPath, prevIndex], lm: currIndex});
                }
            });
            return moveOps;
        } else {
            const opGroups = fieldNames.map((field) => {
                const doc = this.getDoc();
                if(field) {
                    const removeP = [...this.getPath(), ...ShareDBJSONEditorBinding.getShareDBPath(prevParentPath, this.getEditorRootNode()), field];
                    console.log(removeP);
                    const value = ShareDBJSONEditorBinding.traverseData(doc.data, removeP);
                    const addP = [...this.getPath(), ...ShareDBJSONEditorBinding.getShareDBPath(currParentPath, this.getEditorRootNode()), field];
                    return [{ p: removeP, od: value }, {p: addP, oi: value}];
                } else {
                    const removeP = [...this.getPath(), ...ShareDBJSONEditorBinding.getShareDBPath(prevParentPath, this.getEditorRootNode()), prevIndex];
                    const value = ShareDBJSONEditorBinding.traverseData(doc.data, removeP);
                    const addP = [...this.getPath(), ...ShareDBJSONEditorBinding.getShareDBPath(currParentPath, this.getEditorRootNode()), currIndex];
                    const addingTo = ShareDBJSONEditorBinding.traverseData(doc.data, currParentPath);
                    if(addingTo instanceof Array) {
                        return [{ p: removeP, ld: value }, {p: addP, li: value}];
                    } else {
                        return [{ p: removeP, ld: value }, {p: addP, oi: value}];
                    }
                }
            });
            return flatten(opGroups as any);
        }
    }

    private getEditorRootNode(): JSONEditorNode {
        return (this.getEditor() as any).node as JSONEditorNode;
    }

    private static removePrefix(prefix: ShareDB.Path, path: ShareDB.Path) {
        return path.slice(prefix.length);
    }
}