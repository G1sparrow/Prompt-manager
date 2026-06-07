document.addEventListener('DOMContentLoaded', function () {
    initApp();
});

let currentView = 'expand';
let currentFolderId = null;
let currentPromptContent = '';
let currentNegativeContent = '';
let currentPromptSource = null;
let editingSdModelId = null;
let currentInspectFile = null;
let uploadedFileCache = {};
let sdModelsCache = null;
let currentPromptsData = [];

function initApp() {
    loadFolders();
    loadConfig();

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function () {
            const view = this.dataset.view;
            switchView(view);
        });
    });

    document.getElementById('btn-add-folder').addEventListener('click', addFolder);
    document.getElementById('btn-expand').addEventListener('click', doExpand);
    document.getElementById('btn-translate').addEventListener('click', doTranslate);
    document.getElementById('btn-copy-expand').addEventListener('click', () => copyText('expand-content'));
    document.getElementById('btn-copy-translate').addEventListener('click', () => copyText('translate-content'));
    document.getElementById('btn-copy-detail').addEventListener('click', () => copyText('detail-content-text'));
    document.getElementById('btn-save-expand').addEventListener('click', () => showSaveDialog('expand'));
    document.getElementById('btn-save-translate').addEventListener('click', () => showSaveDialog('translate'));
    document.getElementById('btn-back-to-folder').addEventListener('click', backToFolder);
    document.getElementById('btn-delete-detail').addEventListener('click', deleteCurrentPrompt);
    document.getElementById('btn-save-config').addEventListener('click', saveConfig);
document.getElementById('dialog-cancel').addEventListener('click', hideSaveDialog);
document.getElementById('dialog-confirm').addEventListener('click', confirmSave);
document.getElementById('dialog-sampler').addEventListener('change', function() {
    const customInput = document.getElementById('dialog-sampler-custom');
    if (this.value === '__custom__') {
        customInput.classList.add('show');
        customInput.focus();
    } else {
        customInput.classList.remove('show');
        customInput.value = '';
    }
});
document.getElementById('dialog-model').addEventListener('change', function() {
    const customInput = document.getElementById('dialog-model-custom');
    if (this.value === '__custom__') {
        customInput.classList.add('show');
        customInput.focus();
    } else {
        customInput.classList.remove('show');
        customInput.value = '';
    }
});
document.getElementById('folder-model-filter').addEventListener('change', function() {
    renderPromptCards();
});
document.getElementById('btn-new-prompt').addEventListener('click', () => showSaveDialog('new'));
    document.getElementById('btn-add-expand').addEventListener('click', () => showSaveDialog('expand'));
    document.getElementById('btn-add-translate').addEventListener('click', () => showSaveDialog('translate'));
    document.getElementById('dialog-cfg').addEventListener('input', function () {
        document.getElementById('cfg-value').textContent = parseFloat(this.value).toFixed(1);
    });
    document.getElementById('btn-manage-presets').addEventListener('click', showPresetManager);
    document.getElementById('btn-close-presets').addEventListener('click', hidePresetManager);
    document.getElementById('btn-add-preset').addEventListener('click', () => showPresetEditor(null));
    document.getElementById('preset-edit-cancel').addEventListener('click', hidePresetEditor);
    document.getElementById('preset-edit-confirm').addEventListener('click', confirmPresetEdit);

    document.getElementById('btn-add-sd-model').addEventListener('click', () => showSdModelDialog(null));
    document.getElementById('sd-model-dialog-cancel').addEventListener('click', hideSdModelDialog);
    document.getElementById('sd-model-dialog-confirm').addEventListener('click', confirmSdModel);

    loadGlobalPrompts();

    /* ========== Save Dialog Image Upload ========== */
    const imgUploadArea = document.getElementById('dialog-image-area');
    const imgFileInput = document.getElementById('dialog-image-file');
    imgUploadArea.addEventListener('click', () => imgFileInput.click());
    imgFileInput.addEventListener('change', function () {
        if (this.files.length > 0) uploadDialogImage(this.files[0]);
    });

    /* ========== Inspect ========== */
    const uploadArea = document.getElementById('inspect-upload-area');
    const fileInput = document.getElementById('inspect-file-input');
    uploadArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', function () {
        if (this.files.length > 0) doInspect(this.files[0]);
    });
    uploadArea.addEventListener('dragover', function (e) {
        e.preventDefault();
        this.classList.add('drag-over');
    });
    uploadArea.addEventListener('dragleave', function () {
        this.classList.remove('drag-over');
    });
    uploadArea.addEventListener('drop', function (e) {
        e.preventDefault();
        this.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) doInspect(e.dataTransfer.files[0]);
    });
    document.getElementById('btn-save-inspect').addEventListener('click', () => showSaveDialog('inspect'));
}

function switchView(view, folderId) {
    currentView = view;

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === view);
    });

    document.querySelectorAll('.content-view').forEach(v => v.classList.remove('active'));

    if (view === 'expand') {
        document.getElementById('view-expand').classList.add('active');
    } else if (view === 'translate') {
        document.getElementById('view-translate').classList.add('active');
    } else if (view === 'inspect') {
        document.getElementById('view-inspect').classList.add('active');
    } else if (view === 'folder') {
        document.getElementById('view-folder').classList.add('active');
        loadPrompts(folderId);
    } else if (view === 'sd-models') {
        document.getElementById('view-sd-models').classList.add('active');
        loadSdModels();
    } else if (view === 'settings') {
        document.getElementById('view-settings').classList.add('active');
        loadConfig();
    }
}

function showFolderView(folderId) {
    currentFolderId = folderId;
    switchView('folder', folderId);

    document.querySelectorAll('.folder-item').forEach(item => {
        item.classList.toggle('active', parseInt(item.dataset.folderId) === folderId);
    });
}

function backToFolder() {
    if (currentFolderId) {
        showFolderView(currentFolderId);
    }
}

/* ========== Folders ========== */
function loadFolders() {
    fetch('/api/folders')
        .then(r => r.json())
        .then(data => {
            const list = document.getElementById('folder-list');
            list.innerHTML = '';
            data.forEach(f => {
                const div = document.createElement('div');
                div.className = 'folder-item';
                div.dataset.folderId = f.id;
                div.innerHTML = `
                    <span class="folder-name">📁 ${f.name}</span>
                    <span class="folder-actions">
                        <button class="btn-del-folder" onclick="deleteFolder(event, ${f.id})">✕</button>
                    </span>
                `;
                div.addEventListener('click', () => showFolderView(f.id));
                if (currentFolderId === f.id) {
                    div.classList.add('active');
                }
                list.appendChild(div);
            });

            updateDialogFolderSelect(data);
        });
}

function addFolder() {
    const name = prompt('请输入文件夹名称：');
    if (!name || !name.trim()) return;

    fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() })
    })
    .then(r => r.json())
    .then(data => {
        if (data.error) {
            alert(data.error);
        } else {
            loadFolders();
        }
    });
}

function deleteFolder(event, folderId) {
    event.stopPropagation();
    if (!confirm('确定要删除这个文件夹吗？其中的提示词也会被删除。')) return;

    fetch(`/api/folders/${folderId}`, { method: 'DELETE' })
        .then(r => r.json())
        .then(data => {
            if (data.success && currentFolderId === folderId) {
                currentFolderId = null;
                switchView('expand');
            }
            loadFolders();
        });
}

/* ========== Prompts ========== */
function renderPromptCards(filterModel) {
    const grid = document.getElementById('folder-prompts-grid');
    const empty = document.getElementById('folder-empty');

    if (filterModel === undefined) {
        filterModel = document.getElementById('folder-model-filter').value;
    }

    const filtered = filterModel
        ? currentPromptsData.filter(p => p.model === filterModel)
        : currentPromptsData;

    if (filtered.length === 0) {
        grid.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    grid.innerHTML = '';
    filtered.forEach(p => {
        const card = document.createElement('div');
        card.className = 'prompt-card';
        const date = new Date(p.created_at).toLocaleString('zh-CN');

        if (p.image_path) {
            card.innerHTML = `
                <div class="card-image-wrap">
                    <img src="${escapeHtml(p.image_path)}" alt="${escapeHtml(p.title)}" loading="lazy">
                </div>
                <div class="card-info">
                    <h4>${escapeHtml(p.title)}</h4>
                    <div class="card-meta">${p.model ? escapeHtml(p.model) : date}</div>
                </div>
            `;
        } else {
            card.innerHTML = `
                <div class="card-no-image">
                    <span class="card-icon">📝</span>
                    <h4>${escapeHtml(p.title)}</h4>
                    <div class="card-meta">${p.model ? escapeHtml(p.model) : date}</div>
                </div>
            `;
        }

        card.addEventListener('click', () => showPromptDetail(p.id));
        grid.appendChild(card);
    });
}

function loadPrompts(folderId) {
    if (!folderId) return;

    const title = document.getElementById('folder-view-title');
    const folderEl = document.querySelector(`.folder-item[data-folder-id="${folderId}"]`);
    const folderName = folderEl ? folderEl.querySelector('.folder-name').textContent.trim() : '文件夹';
    title.textContent = folderName;

    document.getElementById('folder-model-filter').value = '';

    fetch(`/api/folders/${folderId}/prompts`)
        .then(r => r.json())
        .then(data => {
            currentPromptsData = data;
            renderPromptCards('');
        });
}

function showPromptDetail(promptId) {
    fetch(`/api/prompts/${promptId}`)
        .then(r => r.json())
        .then(p => {
            document.querySelectorAll('.content-view').forEach(v => v.classList.remove('active'));
            document.getElementById('view-prompt-detail').classList.add('active');

            document.getElementById('detail-title').textContent = p.title;
            document.getElementById('detail-content-text').textContent = p.content;
            document.getElementById('detail-folder').textContent = '📁 文件夹 #' + p.folder_id;
            document.getElementById('detail-date').textContent = '🕐 ' + new Date(p.created_at).toLocaleString('zh-CN');

            const metaData = [
                { key: 'model', label: '模型', el: 'detail-model', val: p.model },
                { key: 'sampler', label: '采样方法', el: 'detail-sampler', val: p.sampler },
                { key: 'steps', label: '迭代步数', el: 'detail-steps', val: p.steps },
                { key: 'cfg', label: 'CFG', el: 'detail-cfg', val: p.cfg },
                { key: 'seed', label: '种子', el: 'detail-seed', val: p.seed }
            ];
            metaData.forEach(m => {
                const area = document.getElementById(m.el + '-area');
                const text = document.getElementById(m.el);
                if (m.val) {
                    area.style.display = 'flex';
                    text.textContent = m.val;
                } else {
                    area.style.display = 'none';
                }
            });

            const negativeArea = document.getElementById('detail-negative-area');
            const negativeText = document.getElementById('detail-negative-text');
            if (p.negative_content) {
                negativeArea.style.display = 'block';
                negativeText.textContent = p.negative_content;
            } else {
                negativeArea.style.display = 'none';
            }

            const summaryArea = document.getElementById('detail-summary-area');
            const summaryText = document.getElementById('detail-summary-text');
            if (p.summary) {
                summaryArea.style.display = 'block';
                summaryText.textContent = p.summary;
            } else {
                summaryArea.style.display = 'none';
            }

            const imageArea = document.getElementById('detail-image-area');
            const imageEl = document.getElementById('detail-image');
            if (p.image_path) {
                imageArea.style.display = 'block';
                imageEl.src = p.image_path;
            } else {
                imageArea.style.display = 'none';
            }

            document.getElementById('btn-delete-detail').dataset.promptId = p.id;
            currentFolderId = p.folder_id;
        });
}

function deleteCurrentPrompt(event) {
    const promptId = event.target.dataset.promptId;
    if (!confirm('确定要删除这个提示词吗？')) return;

    fetch(`/api/prompts/${promptId}`, { method: 'DELETE' })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                backToFolder();
            }
        });
}

/* ========== Expand ========== */
function doExpand() {
    const input = document.getElementById('expand-input');
    const text = input.value.trim();
    if (!text) {
        alert('请输入要扩写的提示词');
        return;
    }

    const resultArea = document.getElementById('expand-result');
    const loading = document.getElementById('expand-loading');

    resultArea.style.display = 'none';
    loading.style.display = 'flex';

    const presetSelect = document.getElementById('global-prompt-select');
    const globalPromptId = presetSelect.value ? parseInt(presetSelect.value) : null;

    fetch('/api/expand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text, global_prompt_id: globalPromptId })
    })
    .then(r => r.json())
    .then(data => {
        loading.style.display = 'none';
        if (data.error) {
            alert(data.error);
            return;
        }
        document.getElementById('expand-content').textContent = data.result;
        currentPromptContent = data.result;
        currentNegativeContent = '';
        currentPromptSource = 'expand';
        resultArea.style.display = 'block';
    })
    .catch(err => {
        loading.style.display = 'none';
        alert('请求失败: ' + err.message);
    });
}

/* ========== Inspect ========== */
function doInspect(file) {
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/bmp', 'image/avif'];
    if (!allowed.includes(file.type)) {
        alert('不支持的图片格式，请使用 PNG/JPEG/WebP');
        return;
    }

    const formData = new FormData();
    formData.append('image', file);

    const loading = document.getElementById('inspect-loading');
    const resultArea = document.getElementById('inspect-result');
    const errorArea = document.getElementById('inspect-error');
    const preview = document.getElementById('inspect-preview');

    loading.style.display = 'flex';
    resultArea.style.display = 'none';
    errorArea.style.display = 'none';
    preview.style.display = 'none';

    const reader = new FileReader();
    reader.onload = function (e) {
        document.getElementById('inspect-image').src = e.target.result;
        preview.style.display = 'block';
    };
    reader.readAsDataURL(file);

    currentInspectFile = file;

    fetch('/api/inspect', {
        method: 'POST',
        body: formData
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
        loading.style.display = 'none';
        if (data.error) {
            errorArea.style.display = 'block';
            document.getElementById('inspect-error-text').textContent = data.error;
            return;
        }
        document.getElementById('inspect-prompt').textContent = data.prompt || '';
        document.getElementById('inspect-negative').textContent = data.negative_prompt || '(无)';
        document.getElementById('inspect-params').textContent = data.parameters || '(无)';
        currentPromptContent = data.prompt || '';
        currentNegativeContent = data.negative_prompt || '';
        currentPromptSource = 'inspect';
        resultArea.style.display = 'block';
    })
    .catch(function (err) {
        loading.style.display = 'none';
        errorArea.style.display = 'block';
        document.getElementById('inspect-error-text').textContent = '请求失败: ' + err.message;
    });
}

/* ========== SD Model Card Actions ========== */
document.addEventListener('click', function (e) {
    var target = e.target.closest('button');
    if (!target) return;
    var action = target.dataset.action;
    var modelId = target.dataset.id;
    if (action === 'edit' && modelId) showSdModelDialog(parseInt(modelId));
    if (action === 'delete' && modelId) deleteSdModel(parseInt(modelId));
});

/* ========== Shared Event Delegation ========== */
document.addEventListener('click', function (e) {
    var target = e.target;
    if (target.classList.contains('btn-inspect-copy')) {
        var el = document.getElementById(target.dataset.target);
        if (el) copyText(target.dataset.target);
    }
    if (target.classList.contains('btn-inspect-to-expand')) {
        var el = document.getElementById(target.dataset.target);
        if (el) {
            document.getElementById('expand-input').value = el.textContent;
            switchView('expand');
        }
    }
});

/* ========== Translate ========== */
function doTranslate() {
    const input = document.getElementById('translate-input');
    const text = input.value.trim();
    if (!text) {
        alert('请输入要翻译的文本');
        return;
    }

    const target = document.getElementById('translate-target').value;

    const resultArea = document.getElementById('translate-result');
    const loading = document.getElementById('translate-loading');

    resultArea.style.display = 'none';
    loading.style.display = 'flex';

    fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text, target_lang: target })
    })
    .then(r => r.json())
    .then(data => {
        loading.style.display = 'none';
        if (data.error) {
            alert(data.error);
            return;
        }
        document.getElementById('translate-content').textContent = data.result;
        currentPromptContent = data.result;
        currentNegativeContent = '';
        currentPromptSource = 'translate';
        resultArea.style.display = 'block';
    })
    .catch(err => {
        loading.style.display = 'none';
        alert('请求失败: ' + err.message);
    });
}

/* ========== SD Model Management ========== */
function populateSdModelSelects() {
    const modelSelect = document.getElementById('dialog-model');
    const filterSelect = document.getElementById('folder-model-filter');
    if (!modelSelect) return;

    const currentModel = modelSelect.value;
    const currentFilter = filterSelect ? filterSelect.value : '';

    modelSelect.innerHTML = '<option value="">— 选择模型 —</option>';
    if (filterSelect) {
        filterSelect.innerHTML = '<option value="">全部模型</option>';
    }

    if (sdModelsCache) {
        sdModelsCache.forEach(m => {
            const opt1 = document.createElement('option');
            opt1.value = m.name;
            opt1.textContent = m.name;
            modelSelect.appendChild(opt1);

            if (filterSelect) {
                const opt2 = document.createElement('option');
                opt2.value = m.name;
                opt2.textContent = m.name;
                filterSelect.appendChild(opt2);
            }
        });
    }

    const customOpt = document.createElement('option');
    customOpt.value = '__custom__';
    customOpt.textContent = '✏️ 自定义';
    modelSelect.appendChild(customOpt);

    if (currentModel && [...modelSelect.options].some(o => o.value === currentModel)) {
        modelSelect.value = currentModel;
    }

    const customInput = document.getElementById('dialog-model-custom');
    if (modelSelect.value === '__custom__') {
        customInput.classList.add('show');
    } else {
        customInput.classList.remove('show');
        customInput.value = '';
    }

    if (filterSelect && currentFilter && [...filterSelect.options].some(o => o.value === currentFilter)) {
        filterSelect.value = currentFilter;
    }
}

function loadSdModels() {
    fetch('/api/sd-models')
        .then(r => r.json())
        .then(data => {
            sdModelsCache = data;
            populateSdModelSelects();
            const grid = document.getElementById('sd-models-grid');
            const empty = document.getElementById('sd-models-empty');

            if (data.length === 0) {
                grid.innerHTML = '';
                empty.style.display = 'block';
                return;
            }

            empty.style.display = 'none';
            grid.innerHTML = '';
            data.forEach(m => {
                const card = document.createElement('div');
                card.className = 'sd-model-card';
                let paramsHtml = '';
                const paramFields = [
                    { label: '采样方法', val: m.sampler },
                    { label: 'CFG', val: m.cfg },
                    { label: 'VAE', val: m.vae },
                    { label: 'Text Encoder', val: m.text_encoder }
                ];
                paramFields.forEach(p => {
                    if (p.val) {
                        paramsHtml += `<div class="sd-param-row"><span class="sd-param-key">${p.label}</span><span class="sd-param-val">${escapeHtml(p.val)}</span></div>`;
                    }
                });
                if (paramsHtml) {
                    paramsHtml = `<div class="sd-model-params">${paramsHtml}</div>`;
                }
                let descHtml = '';
                if (m.description) {
                    descHtml = `<div class="sd-model-desc">${escapeHtml(m.description)}</div>`;
                }
                card.innerHTML = `
                    <div class="sd-model-card-header">
                        <h4>${escapeHtml(m.name)}</h4>
                    </div>
                    ${paramsHtml}
                    ${descHtml}
                    <div class="sd-model-actions">
                        <button class="btn-small" data-action="edit" data-id="${m.id}">✏️ 编辑</button>
                        <button class="btn-small" data-action="delete" data-id="${m.id}">🗑️ 删除</button>
                    </div>
                `;
                grid.appendChild(card);
            });
        });
}

function showSdModelDialog(modelId) {
    editingSdModelId = modelId;
    document.getElementById('sd-model-name').value = '';
    document.getElementById('sd-model-sampler').value = '';
    document.getElementById('sd-model-cfg').value = '';
    document.getElementById('sd-model-vae').value = '';
    document.getElementById('sd-model-text-encoder').value = '';
    document.getElementById('sd-model-desc').value = '';

    if (modelId) {
        document.getElementById('sd-model-dialog-title').textContent = '编辑 SD 模型';
        fetch('/api/sd-models')
            .then(r => r.json())
            .then(models => {
                const m = models.find(x => x.id === modelId);
                if (m) {
                    document.getElementById('sd-model-name').value = m.name;
                    document.getElementById('sd-model-sampler').value = m.sampler || '';
                    document.getElementById('sd-model-cfg').value = m.cfg || '';
                    document.getElementById('sd-model-vae').value = m.vae || '';
                    document.getElementById('sd-model-text-encoder').value = m.text_encoder || '';
                    document.getElementById('sd-model-desc').value = m.description || '';
                }
            });
    } else {
        document.getElementById('sd-model-dialog-title').textContent = '新增 SD 模型';
    }

    document.getElementById('sd-model-dialog').style.display = 'flex';
}

function hideSdModelDialog() {
    document.getElementById('sd-model-dialog').style.display = 'none';
    editingSdModelId = null;
}

function confirmSdModel() {
    const name = document.getElementById('sd-model-name').value.trim();
    const sampler = document.getElementById('sd-model-sampler').value.trim();
    const cfg = document.getElementById('sd-model-cfg').value.trim();
    const vae = document.getElementById('sd-model-vae').value.trim();
    const textEncoder = document.getElementById('sd-model-text-encoder').value.trim();
    const desc = document.getElementById('sd-model-desc').value.trim();

    if (!name) {
        alert('请输入模型名称');
        return;
    }

    const body = { name, sampler, cfg, vae, text_encoder: textEncoder, description: desc };

    if (editingSdModelId) {
        fetch(`/api/sd-models/${editingSdModelId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        })
        .then(r => r.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
            } else {
                hideSdModelDialog();
                loadSdModels();
            }
        });
    } else {
        fetch('/api/sd-models', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        })
        .then(r => r.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
            } else {
                hideSdModelDialog();
                loadSdModels();
            }
        });
    }
}

function deleteSdModel(modelId) {
    if (!confirm('确定要删除这个模型吗？')) return;
    fetch(`/api/sd-models/${modelId}`, { method: 'DELETE' })
        .then(r => r.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
            } else {
                loadSdModels();
            }
        });
}

/* ========== Save Dialog ========== */
function showSaveDialog(source) {
    currentPromptSource = source;
    document.getElementById('dialog-title').value = '';
    document.getElementById('dialog-model').value = '';
    document.getElementById('dialog-model-custom').value = '';
    document.getElementById('dialog-model-custom').classList.remove('show');
    document.getElementById('dialog-sampler').value = '';
    const customSampler = document.getElementById('dialog-sampler-custom');
    customSampler.classList.remove('show');
    customSampler.value = '';
    document.getElementById('dialog-steps').value = '';
    document.getElementById('dialog-cfg').value = '7';
    document.getElementById('cfg-value').textContent = '7.0';
    document.getElementById('dialog-seed').value = '';
    document.getElementById('dialog-summary').value = '';

    if (source === 'inspect' && currentInspectFile) {
        var fileKey = currentInspectFile.name + '|' + currentInspectFile.size + '|' + currentInspectFile.lastModified;
        if (uploadedFileCache[fileKey]) {
            var cachedUrl = uploadedFileCache[fileKey];
            document.getElementById('dialog-image-url').value = cachedUrl;
            var preview = document.getElementById('dialog-image-preview');
            preview.src = cachedUrl;
            preview.style.display = 'block';
            document.getElementById('dialog-image-placeholder').style.display = 'none';
        } else {
            var formData = new FormData();
            formData.append('image', currentInspectFile);
            fetch('/api/upload-image', { method: 'POST', body: formData })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (data.image_url) {
                        uploadedFileCache[fileKey] = data.image_url;
                        document.getElementById('dialog-image-url').value = data.image_url;
                        var preview = document.getElementById('dialog-image-preview');
                        preview.src = data.image_url;
                        preview.style.display = 'block';
                        document.getElementById('dialog-image-placeholder').style.display = 'none';
                    }
                })
                .catch(function () {});
        }
    } else {
        document.getElementById('dialog-image-url').value = '';
        document.getElementById('dialog-image-preview').style.display = 'none';
        document.getElementById('dialog-image-preview').src = '';
        document.getElementById('dialog-image-placeholder').style.display = 'flex';
    }

    const posField = document.getElementById('dialog-content-positive');
    const negField = document.getElementById('dialog-content-negative');
    if (source === 'new') {
        posField.value = '';
        posField.placeholder = '输入正面提示词...';
        negField.value = '';
        negField.placeholder = '输入负面提示词（可选）';
    } else {
        posField.value = currentPromptContent || '';
        posField.placeholder = '';
        negField.value = currentNegativeContent || '';
        negField.placeholder = '';
    }

    document.getElementById('save-dialog').style.display = 'flex';
    if (source === 'new' && currentFolderId) {
        const folderSelect = document.getElementById('dialog-folder');
        for (let opt of folderSelect.options) {
            if (parseInt(opt.value) === currentFolderId) {
                folderSelect.value = currentFolderId;
                break;
            }
        }
    }
}

function hideSaveDialog() {
    document.getElementById('save-dialog').style.display = 'none';
}

function uploadDialogImage(file) {
    const formData = new FormData();
    formData.append('image', file);

    fetch('/api/upload-image', {
        method: 'POST',
        body: formData
    })
    .then(r => r.json())
    .then(data => {
        if (data.error) {
            alert(data.error);
            return;
        }
        document.getElementById('dialog-image-url').value = data.image_url;
        const preview = document.getElementById('dialog-image-preview');
        preview.src = data.image_url;
        preview.style.display = 'block';
        document.getElementById('dialog-image-placeholder').style.display = 'none';
    })
    .catch(err => {
        alert('图片上传失败: ' + err.message);
    });
}

function confirmSave() {
    const title = document.getElementById('dialog-title').value.trim();
    const folderId = parseInt(document.getElementById('dialog-folder').value);
    const posContent = document.getElementById('dialog-content-positive').value.trim();
    const negContent = document.getElementById('dialog-content-negative').value.trim();
    const summary = document.getElementById('dialog-summary').value.trim();
    const imageUrl = document.getElementById('dialog-image-url').value.trim();
    const modelSelect = document.getElementById('dialog-model');
    const model = modelSelect.value === '__custom__'
        ? document.getElementById('dialog-model-custom').value.trim()
        : modelSelect.value.trim();
    const samplerSelect = document.getElementById('dialog-sampler');
    const sampler = samplerSelect.value === '__custom__'
        ? document.getElementById('dialog-sampler-custom').value.trim()
        : samplerSelect.value.trim();
    const steps = document.getElementById('dialog-steps').value.trim();
    const cfg = document.getElementById('dialog-cfg').value.trim();
    const seed = document.getElementById('dialog-seed').value.trim();

    const saveContent = posContent || currentPromptContent;
    if (!saveContent) {
        alert('请输入正面提示词');
        return;
    }
    const saveNegContent = negContent || currentNegativeContent;

    fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            folder_id: folderId,
            title: title,
            content: saveContent,
            negative_content: saveNegContent,
            summary: summary,
            image_path: imageUrl,
            model: model,
            sampler: sampler,
            steps: steps,
            cfg: cfg,
            seed: seed
        })
    })
    .then(r => r.json())
    .then(data => {
        if (data.error) {
            alert(data.error);
        } else {
            hideSaveDialog();
            if (currentFolderId) {
                showFolderView(currentFolderId);
            }
        }
    });
}

function updateDialogFolderSelect(folders) {
    const select = document.getElementById('dialog-folder');
    select.innerHTML = '';
    folders.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = f.name;
        select.appendChild(opt);
    });
}

/* ========== Config ========== */
function loadConfig() {
    fetch('/api/config')
        .then(r => r.json())
        .then(cfg => {
            document.getElementById('cfg-llm-base-url').value = cfg.llm.base_url || '';
            document.getElementById('cfg-llm-api-key').value = cfg.llm.api_key || '';
            populateModelSelect(cfg);
            document.getElementById('cfg-baidu-appid').value = cfg.baidu_translate.appid || '';
            document.getElementById('cfg-baidu-secret').value = cfg.baidu_translate.secret_key || '';
            updateApiStatus(cfg);
        });
}

function populateModelSelect(cfg) {
    const select = document.getElementById('cfg-llm-model');
    const currentModel = cfg.llm.model || '';
    const presets = cfg.preset_models || [];

    select.innerHTML = '<option value="">-- 选择模型 --</option>';
    presets.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        select.appendChild(opt);
    });
    const customOpt = document.createElement('option');
    customOpt.value = '__custom__';
    customOpt.textContent = '其他 (自定义)';
    select.appendChild(customOpt);

    if (presets.includes(currentModel)) {
        select.value = currentModel;
        document.getElementById('cfg-llm-model-custom-wrap').style.display = 'none';
    } else if (currentModel) {
        select.value = '__custom__';
        document.getElementById('cfg-llm-model-custom').value = currentModel;
        document.getElementById('cfg-llm-model-custom-wrap').style.display = 'block';
    } else {
        select.value = '';
        document.getElementById('cfg-llm-model-custom-wrap').style.display = 'none';
    }
}

document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'cfg-llm-model') {
        const val = e.target.value;
        const customWrap = document.getElementById('cfg-llm-model-custom-wrap');
        if (val === '__custom__') {
            customWrap.style.display = 'block';
        } else {
            customWrap.style.display = 'none';
        }
    }
});

function saveConfig() {
    let model = document.getElementById('cfg-llm-model').value.trim();
    if (model === '__custom__') {
        model = document.getElementById('cfg-llm-model-custom').value.trim();
    } else if (model === '') {
        model = '';
    }
    const config = {
        llm: {
            base_url: document.getElementById('cfg-llm-base-url').value.trim(),
            api_key: document.getElementById('cfg-llm-api-key').value.trim(),
            model: model
        },
        baidu_translate: {
            appid: document.getElementById('cfg-baidu-appid').value.trim(),
            secret_key: document.getElementById('cfg-baidu-secret').value.trim()
        }
    };

    fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
    })
    .then(r => r.json())
    .then(data => {
        const status = document.getElementById('config-status');
        if (data.success) {
            status.className = 'config-status success';
            status.textContent = '✅ 配置保存成功！';
            updateApiStatus(config);
        } else {
            status.className = 'config-status error';
            status.textContent = '❌ ' + (data.error || '保存失败');
        }
    });
}

function updateApiStatus(cfg) {
    const statusEl = document.getElementById('status-api');
    const hasLlm = cfg.llm && cfg.llm.api_key && cfg.llm.api_key.length > 0;
    const hasBaidu = cfg.baidu_translate && cfg.baidu_translate.appid && cfg.baidu_translate.secret_key;

    let parts = [];
    if (hasLlm) {
        parts.push('✅ LLM: ' + (cfg.llm.model || '已配置'));
    } else {
        parts.push('⚠️ LLM: 未配置');
    }
    if (hasBaidu) {
        parts.push('✅ 百度翻译: 已配置');
    } else {
        parts.push('⚠️ 百度翻译: 未配置');
    }
    statusEl.textContent = parts.join(' | ');
}

/* ========== Global Prompts ========== */
let presetEditId = null;

function loadGlobalPrompts() {
    fetch('/api/global-prompts')
        .then(r => r.json())
        .then(data => {
            const select = document.getElementById('global-prompt-select');
            select.innerHTML = '';
            data.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.name + (p.is_builtin ? '' : ' (自定义)');
                select.appendChild(opt);
            });
            if (data.length > 0) {
                select.selectedIndex = 0;
            }
        });
}

function showPresetManager() {
    document.getElementById('preset-dialog').style.display = 'flex';
    renderPresetList();
}

function hidePresetManager() {
    document.getElementById('preset-dialog').style.display = 'none';
}

function renderPresetList() {
    const list = document.getElementById('preset-list');
    list.innerHTML = '<div class="loading-indicator" style="display:flex"><div class="spinner"></div><span>加载中...</span></div>';

    fetch('/api/global-prompts')
        .then(r => r.json())
        .then(data => {
            list.innerHTML = '';
            data.forEach(p => {
                const item = document.createElement('div');
                item.className = 'preset-item';
                const preview = p.content.length > 100 ? p.content.slice(0, 100) + '...' : p.content;
                const badge = p.is_builtin ? '<span class="preset-badge">内置</span>' : '';
                const actions = p.is_builtin ? '' : `
                    <span class="preset-actions">
                        <button class="btn-small" onclick="showPresetEditor(${p.id})">✏️</button>
                        <button class="btn-small" onclick="deletePreset(${p.id})">🗑️</button>
                    </span>
                `;
                item.innerHTML = `
                    <div class="preset-info">
                        <div class="preset-name">${escapeHtml(p.name)}</div>
                        <div class="preset-preview">${escapeHtml(preview)}</div>
                    </div>
                    ${badge}
                    ${actions}
                `;
                list.appendChild(item);
            });
        });
}

const PRESET_TEMPLATE = `You are a specialist in [STYLE] prompt expansion. Your task is to expand the user's short prompt into a detailed, high-quality [STYLE] description for generating [STYLE] images.

Please strictly follow these rules:

1. **Rule One**: [Describe the first key rule for this style]
2. **Rule Two**: [Describe the second key rule]
3. **Rule Three**: [Describe the third key rule]
4. **Prohibited**: [List what should NOT appear in this style]
5. **Output Constraints**:
   - Output ONLY the expanded English prompt, no explanations, no prefixes.
   - Length: [min]-[max] words.
   - End with: [quality suffix keywords]

User input: {user_input}

Please output:`;

function showPresetEditor(presetId) {
    presetEditId = presetId;
    const title = document.getElementById('preset-edit-title');
    const nameInput = document.getElementById('preset-edit-name');
    const contentInput = document.getElementById('preset-edit-content');

    if (presetId) {
        title.textContent = '编辑预设';
        fetch(`/api/global-prompts/${presetId}`)
            .then(r => r.json())
            .then(p => {
                nameInput.value = p.name;
                contentInput.value = p.content;
            });
    } else {
        title.textContent = '新建预设';
        nameInput.value = '';
        contentInput.value = PRESET_TEMPLATE;
    }

    document.getElementById('preset-edit-dialog').style.display = 'flex';
}

function hidePresetEditor() {
    document.getElementById('preset-edit-dialog').style.display = 'none';
    presetEditId = null;
}

function confirmPresetEdit() {
    const name = document.getElementById('preset-edit-name').value.trim();
    const content = document.getElementById('preset-edit-content').value.trim();

    if (!name) { alert('请输入预设名称'); return; }
    if (!content) { alert('请输入系统指令内容'); return; }

    if (presetEditId) {
        fetch(`/api/global-prompts/${presetEditId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, content })
        })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                hidePresetEditor();
                renderPresetList();
                loadGlobalPrompts();
            } else {
                alert(data.error || '更新失败');
            }
        });
    } else {
        fetch('/api/global-prompts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, content })
        })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                hidePresetEditor();
                renderPresetList();
                loadGlobalPrompts();
            } else {
                alert(data.error || '创建失败');
            }
        });
    }
}

function deletePreset(presetId) {
    if (!confirm('确定要删除这个预设吗？')) return;
    fetch(`/api/global-prompts/${presetId}`, { method: 'DELETE' })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                renderPresetList();
                loadGlobalPrompts();
            }
        });
}

/* ========== Utils ========== */
function copyText(elementId) {
    const el = document.getElementById(elementId);
    const text = el.textContent || el.innerText;
    navigator.clipboard.writeText(text).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
