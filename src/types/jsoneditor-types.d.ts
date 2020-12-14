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
