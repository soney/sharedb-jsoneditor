# sharedb-jsoneditor

Warning: this library is *very* hacky and preliminary. You should *not* depend on it.

![Image of two synchronized JSONEditor instances](https://github.com/soney/sharedb-jsoneditor/raw/main/resources/sample_interaction.gif)

This library provides a frontend for visualizing ShareDB documents using [JSONEditor](https://github.com/josdejong/jsoneditor).

Installing:
```bash
npm i --save sharedb-jsoneditor
```

```html
<div id="jsoneditor2" style="width: 400px; height: 400px;"></div>
```

```javascript
const jsonEditor = new ShareDBJSONEditor(doc, document.getElementById('jsoneditor'), []);
```
