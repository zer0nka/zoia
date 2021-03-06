/* eslint-disable import/no-webpack-loader-syntax */
const ace = process.browser ? require("ace-builds") : null;
const ClassicEditor = process.browser ? require("@ckeditor/ckeditor5-build-classic") : null;
const beautify = require("js-beautify");
const throttle = require("lodash.throttle");
const {
    v4: uuidv4
} = require("uuid");
const axios = require("axios");
const {
    cloneDeep
} = require("lodash");
const CKEditorImageUploadAdapter = require("./CKEditorImageUploadAdapter");

if (process.browser) {
    // require("ace-builds/webpack-resolver");
    ace.config.setModuleUrl("ace/mode/html_worker", require("file-loader?name=npm.ace-builds.worker-html.[contenthash:8].js&esModule=false!../../../../../../node_modules/ace-builds/src-noconflict/worker-html.js"));
    ace.config.setModuleUrl("ace/mode/css_worker", require("file-loader?name=npm.ace-builds.worker-css.[contenthash:8].js&esModule=false!../../../../../../node_modules/ace-builds/src-noconflict/worker-css.js"));
    ace.config.setModuleUrl("ace/mode/javascript_worker", require("file-loader?name=npm.ace-builds.worker-javascript.[contenthash:8].js&esModule=false!../../../../../../node_modules/ace-builds/src-noconflict/worker-javascript.js"));
    ace.config.setModuleUrl("ace/mode/html", require("file-loader?name=npm.ace-builds.mode-html.[contenthash:8].js&esModule=false!../../../../../../node_modules/ace-builds/src-noconflict/mode-html.js"));
    ace.config.setModuleUrl("ace/mode/javascript", require("file-loader?name=npm.ace-builds.mode-javascript.[contenthash:8].js&esModule=false!../../../../../../node_modules/ace-builds/src-noconflict/mode-javascript.js"));
    ace.config.setModuleUrl("ace/mode/css", require("file-loader?name=npm.ace-builds.mode-css.[contenthash:8].js&esModule=false!../../../../../../node_modules/ace-builds/src-noconflict/mode-css.js"));
    ace.config.setModuleUrl("ace/theme/chrome", require("file-loader?name=npm.ace-builds.theme-chrome.[contenthash:8].js&esModule=false!../../../../../../node_modules/ace-builds/src-noconflict/theme-chrome.js"));
    ace.config.setModuleUrl("ace/mode/json", require("file-loader?name=npm.ace-builds.mode-json.[contenthash:8].js&esModule=false!../../../../../../node_modules/ace-builds/src-noconflict/mode-json.js"));
    ace.config.setModuleUrl("ace/mode/json_worker", require("file-loader?name=npm.ace-builds.worker-json.[contenthash:8].js&esModule=false!../../../../../../node_modules/ace-builds/src-noconflict/worker-json.js"));
}

function AddClassToAllHeading1(editor) {
    // Both the data and the editing pipelines are affected by this conversion.
    editor.conversion.for("downcast").add(dispatcher => {
        // Headings are represented in the model as a "heading1" element.
        // Use the "low" listener priority to apply the changes after the headings feature.
        dispatcher.on("insert:heading1", (evt, data, conversionApi) => {
            const viewWriter = conversionApi.writer;
            viewWriter.addClass("title", conversionApi.mapper.toViewElement(data.item));
            viewWriter.addClass("is-1", conversionApi.mapper.toViewElement(data.item));
        }, {
            priority: "low"
        });
    });
}

module.exports = class {
    onCreate(input, out) {
        const state = {
            captchaData: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
            captchaSecret: "",
            toggleAce: {},
            modeAce: "ace",
            visible: true,
            enabled: true,
            mandatory: input.item.mandatory,
            item: input.item
        };
        this.state = state;
        this.state.item = input.item;
        this.func = {
            setFocus: this.setFocus.bind(this),
            reloadCaptcha: this.reloadCaptcha.bind(this),
            performUpdate: this.performUpdate.bind(this),
            insertImage: this.insertImage.bind(this),
            setHeaders: this.setHeaders.bind(this),
            setVisible: this.setVisible.bind(this),
            setEnabled: this.setEnabled.bind(this),
            setMandatory: this.setMandatory.bind(this),
            setData: this.setData.bind(this),
            getData: this.getData.bind(this),
            setAceValue: this.setAceValue.bind(this),
        };
        this.beautifyOptions = {
            indent_size: "2",
            indent_char: " ",
            max_preserve_newlines: "5",
            preserve_newlines: true,
            keep_array_indentation: false,
            break_chained_methods: false,
            indent_scripts: "normal",
            brace_style: "expand",
            space_before_conditional: true,
            unescape_strings: false,
            jslint_happy: false,
            end_with_newline: false,
            wrap_line_length: "80",
            indent_inner_html: true,
            comma_first: false,
            e4x: false
        };
        this.i18n = out.global.i18n;
    }

    performUpdate() {
        switch (this.state.item.type) {
        case "ace":
            throttle(this.updateAce.bind(this), 300)();
            break;
        }
    }

    insertImage(url) {
        switch (this.state.item.type) {
        case "ace":
            if (this.state.modeAce === "ace") {
                const imgTag = `<img src="${url}" alt=""/>`;
                this.aceEditor.getSession().insert(this.aceEditor.getCursorPosition(), imgTag);
            } else {
                const viewFragment = this.ckEditor.data.processor.toView(`<img src="${url}" alt=""/>`);
                const modelFragment = this.ckEditor.data.toModel(viewFragment);
                this.ckEditor.model.change(writer => {
                    writer.insert(modelFragment, this.ckEditor.model.document.selection.getFirstPosition());
                });
            }
            break;
        }
    }

    setAceValue(value) {
        if (!this.aceEditor) {
            return;
        }
        this.aceEditor.getSession().setValue(value);
    }

    updateAce() {
        if (!this.aceEditor) {
            return;
        }
        const value = (this.state.modeAce === "ace" && this.state.item.aceOptions && this.state.item.aceOptions.mode === "ace/mode/html" ? beautify.html(this.input.value, this.beautifyOptions) : this.input.value) || "";
        this.aceEditor.getSession().setValue(value);
        if (this.state.item.wysiwyg) {
            this.ckEditor.setData(value);
        }
    }

    async reloadCaptcha() {
        if (this.state.item.type === "captcha") {
            try {
                const res = await axios.post("/api/core/captcha");
                this.state.captchaData = res.data.imageData;
                this.state.captchaSecret = res.data.imageSecret;
                this.emit("captcha", this.state.captchaSecret);
            } catch (e) {
                // Ignore
            }
        }
    }

    async onMount() {
        await this.reloadCaptcha();
        switch (this.state.item.type) {
        case "ace":
            if (!document.getElementById(`${this.state.item.id}_ace`)) {
                return;
            }
            [this.aceEditorElement] = document.getElementById(`${this.state.item.id}_ace`).getElementsByTagName("div");
            this.aceEditor = ace.edit(this.aceEditorElement);
            const aceDefaults = {
                mode: "ace/mode/html",
                theme: "ace/theme/chrome",
                fontSize: "16px",
                wrap: true,
                useSoftTabs: true,
                tabSize: 2
            };
            this.aceEditor.setOptions(this.state.item.aceOptions ? {
                ...aceDefaults,
                ...this.state.item.aceOptions
            } : aceDefaults);
            this.aceEditor.getSession().on("change", () => {
                const value = this.aceEditor.getSession().getValue();
                this.emit("value-change", {
                    type: "input",
                    id: this.state.item.id,
                    value
                });
            });
            // Remove annotations, e.g.
            // "Non-space characters found without seeing a doctype first. Expected e.g. <!DOCTYPE html>."
            this.aceEditor.getSession().on("changeAnnotation", () => {
                const annotations = this.aceEditor.getSession().getAnnotations();
                const annotationsFiltered = annotations.filter(a => a && !a.text.match(/DOCTYPE html/));
                if (annotations.length > annotationsFiltered.length) {
                    this.aceEditor.getSession().setAnnotations(annotationsFiltered);
                }
            });
            if (this.state.item.wysiwyg) {
                this.ckEditorElement = this.getEl(`mf_ctl_ckeditor_${this.input.item.id}`);
                this.ckEditor = await ClassicEditor.create(this.ckEditorElement, {
                    extraPlugins: [AddClassToAllHeading1],
                });
                this.ckEditor.plugins.get("FileRepository").createUploadAdapter = loader => {
                    this.ckEditorImageUploadAdapter = new CKEditorImageUploadAdapter(loader, {
                        url: "/api/core/mform/image/upload",
                        headers: this.headers
                    });
                    return this.ckEditorImageUploadAdapter;
                };
                this.ckEditor.model.document.on("change:data", () => {
                    const value = this.ckEditor.getData();
                    this.emit("value-change", {
                        type: "input",
                        id: this.state.item.id,
                        value
                    });
                });
            }
            break;
        }
        this.emit("settled");
    }

    setFocus() {
        let field;
        switch (this.state.item.type) {
        case "radio":
            field = this.getEl(`mf_ctl_${this.state.item.id}_0`);
            break;
        default:
            field = this.getEl(`mf_ctl_${this.state.item.id}`);
        }
        if (field) {
            field.focus();
        }
    }

    onRangeFieldValueChange(e) {
        const field = this.getEl(`mf_ctl_${this.state.item.id}`);
        if (field) {
            field.focus();
        }
        this.onFieldValueChange(e);
    }

    onFieldValueChange(e) {
        const event = Object.keys(e.target.dataset).length ? {
            dataset: e.target.dataset,
            value: e.target.value
        } : Object.keys(e.target.parentNode.dataset).length ? {
            dataset: e.target.parentNode.dataset,
            value: e.target.parentNode.value
        } : Object.keys(e.target.parentNode.parentNode.dataset).length ? {
            dataset: e.target.parentNode.parentNode.dataset,
            value: e.target.parentNode.parentNode.value
        } : {};
        this.emit("value-change", {
            type: "input",
            id: event.dataset.id,
            value: event.value
        });
    }

    onArrInputChange(e) {
        this.emit("value-change", {
            type: "arr",
            id: e.target.dataset.id,
            inputid: e.target.dataset.inputid,
            value: e.target.checked
        });
    }

    onBooleanInputChange(e) {
        this.emit("value-change", {
            type: "boolean",
            id: e.target.dataset.id,
            value: !!e.target.checked
        });
    }

    onFileInputChange(e) {
        this.emit("value-change", {
            id: e.target.dataset.id,
            type: "file",
            value: Array.from(e.target.files).map((file, index) => {
                const fileData = e.target.files[index];
                const uid = uuidv4();
                fileData.zuid = uid;
                return {
                    type: "file",
                    name: file.name,
                    id: uid,
                    data: e.target.files[index],
                };
            })
        });
    }

    onFileRemove(e) {
        const dataset = e.target ? (Object.keys(e.target.dataset).length ? e.target.dataset : Object.keys(e.target.parentNode.dataset).length ? e.target.parentNode.dataset : Object.keys(e.target.parentNode.parentNode.dataset).length ? e.target.parentNode.parentNode.dataset : {}) : e;
        this.emit("remove-arr-item", {
            id: dataset.id,
            itemid: dataset.itemid
        });
    }

    onButtonClick(e) {
        const dataset = e.target ? (Object.keys(e.target.dataset).length ? e.target.dataset : Object.keys(e.target.parentNode.dataset).length ? e.target.parentNode.dataset : Object.keys(e.target.parentNode.parentNode.dataset).length ? e.target.parentNode.parentNode.dataset : {}) : e;
        this.emit("button-click", {
            id: dataset.id
        });
    }

    onAceToggleClick(e) {
        e.preventDefault();
        const dataset = e.target ? (Object.keys(e.target.dataset).length ? e.target.dataset : Object.keys(e.target.parentNode.dataset).length ? e.target.parentNode.dataset : Object.keys(e.target.parentNode.parentNode.dataset).length ? e.target.parentNode.parentNode.dataset : {}) : e;
        const toggle = cloneDeep(this.state.toggleAce);
        toggle[dataset.id] = !toggle[dataset.id];
        if (toggle[dataset.id]) {
            setTimeout(() => this.aceEditor.getSession().setValue(this.input.value || ""), 100);
            if (this.state.item.wysiwyg) {
                setTimeout(() => this.ckEditor.setData(this.input.value || ""), 100);
            }
        }
        this.setState("toggleAce", toggle);
        this.forceUpdate();
    }

    onKeyValueButtonClick(e) {
        e.preventDefault();
        const dataset = Object.keys(e.target.dataset).length ? e.target.dataset : Object.keys(e.target.parentNode.dataset).length ? e.target.parentNode.dataset : Object.keys(e.target.parentNode.parentNode.dataset).length ? e.target.parentNode.parentNode.dataset : {};
        this.emit("get-key-value", {
            id: dataset.id,
        });
    }

    onAceModeChange(e) {
        e.preventDefault();
        const dataset = Object.keys(e.target.dataset).length ? e.target.dataset : Object.keys(e.target.parentNode.dataset).length ? e.target.parentNode.dataset : Object.keys(e.target.parentNode.parentNode.dataset).length ? e.target.parentNode.parentNode.dataset : {};
        if (dataset.id !== this.state.modeAce) {
            this.setState("modeAce", dataset.id);
            const value = dataset.id === "ace" ? beautify.html(this.input.value, this.beautifyOptions) : this.input.value;
            setTimeout(() => this.aceEditor.getSession().setValue(value || ""), 10);
            setTimeout(() => this.ckEditor.setData(this.input.value || ""), 10);
        }
    }

    onImageBrowser(e) {
        e.preventDefault();
        const width = window.screen.width > 768 ? window.screen.width / 2 : window.screen.width;
        const height = window.screen.width > 768 ? window.screen.height / 2 : window.screen.height;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 4;
        window.open(this.i18n.getLocalizedURL("/z3/core/images"), "", `toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=no, resizable=no, copyhistory=no, width=${width}, height=${height}, top=${top}, left=${left}`);
    }

    setHeaders(headers) {
        this.headers = headers;
    }

    onContextMenu(e) {
        const fileId = e.target.dataset ? e.target.dataset.mfimageid : e.target.parentNode && e.target.parentNode.dataset && e.target.parentNode.dataset.mfimageid ? e.target.parentNode.dataset.mfimageid : e.target.parentNode && e.target.parentNode.parentNode && e.target.parentNode.parentNode.dataset && e.target.parentNode.parentNode.dataset.mfimageid ? e.target.parentNode.parentNode.dataset.mfimageid : null;
        if (fileId) {
            e.stopPropagation();
            e.preventDefault();
            this.emit("context-menu", {
                x: e.pageX,
                y: e.pageY,
                id: fileId,
                fieldId: this.input.item.id
            });
        }
    }

    setVisible(flag) {
        this.state.visible = flag;
    }

    setEnabled(flag) {
        this.state.enabled = flag;
    }

    setMandatory(flag) {
        this.state.mandatory = flag;
    }

    setData(data) {
        this.setState("item", data);
    }

    getData() {
        return this.state.item;
    }
};
