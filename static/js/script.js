document.addEventListener('DOMContentLoaded', function () {
    initApp();
});

let currentView = 'expand';
let currentFolderId = null;
let currentPromptContent = '';
let currentPromptSource = null;

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
    document.getElementById('btn-new-prompt').addEventListener('click', () => showSaveDialog('new'));
    document.getElementById('btn-add-expand').addEventListener('click', () => showSaveDialog('expand'));
    document.getElementById('btn-add-translate').addEventListener('click', () => showSaveDialog('translate'));
    document.getElementById('btn-manage-presets').addEventListener('click', showPresetManager);
    document.getElementById('btn-close-presets').addEventListener('click', hidePresetManager);
    document.getElementById('btn-add-preset').addEventListener('click', () => showPresetEditor(null));
    document.getElementById('preset-edit-cancel').addEventListener('click', hidePresetEditor);
    document.getElementById('preset-edit-confirm').addEventListener('click', confirmPresetEdit);

    loadGlobalPrompts();

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
function loadPrompts(folderId) {
    if (!folderId) return;

    const title = document.getElementById('folder-view-title');
    const folderEl = document.querySelector(`.folder-item[data-folder-id="${folderId}"]`);
    const folderName = folderEl ? folderEl.querySelector('.folder-name').textContent.trim() : '文件夹';
    title.textContent = folderName;

    fetch(`/api/folders/${folderId}/prompts`)
        .then(r => r.json())
        .then(data => {
            const grid = document.getElementById('folder-prompts-grid');
            const empty = document.getElementById('folder-empty');

            if (data.length === 0) {
                grid.innerHTML = '';
                empty.style.display = 'block';
                return;
            }

            empty.style.display = 'none';
            grid.innerHTML = '';
            data.forEach(p => {
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
                            <div class="card-meta">${date}</div>
                        </div>
                    `;
                } else {
                    card.innerHTML = `
                        <div class="card-no-image">
                            <span class="card-icon">📝</span>
                            <h4>${escapeHtml(p.title)}</h4>
                            <div class="card-meta">${date}</div>
                        </div>
                    `;
                }

                card.addEventListener('click', () => showPromptDetail(p.id));
                grid.appendChild(card);
            });
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
        currentPromptSource = 'inspect';
        resultArea.style.display = 'block';
    })
    .catch(function (err) {
        loading.style.display = 'none';
        errorArea.style.display = 'block';
        document.getElementById('inspect-error-text').textContent = '请求失败: ' + err.message;
    });
}

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
        currentPromptSource = 'translate';
        resultArea.style.display = 'block';
    })
    .catch(err => {
        loading.style.display = 'none';
        alert('请求失败: ' + err.message);
    });
}

/* ========== Save Dialog ========== */
function showSaveDialog(source) {
    currentPromptSource = source;
    document.getElementById('dialog-title').value = '';
    document.getElementById('dialog-summary').value = '';
    document.getElementById('dialog-image-url').value = '';

    const contentField = document.getElementById('dialog-content');
    if (source === 'new') {
        contentField.value = '';
        contentField.placeholder = '输入提示词内容...';
    } else {
        contentField.value = currentPromptContent || '';
        contentField.placeholder = '';
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

function confirmSave() {
    const title = document.getElementById('dialog-title').value.trim();
    const folderId = parseInt(document.getElementById('dialog-folder').value);
    const content = document.getElementById('dialog-content').value.trim();
    const summary = document.getElementById('dialog-summary').value.trim();
    const imageUrl = document.getElementById('dialog-image-url').value.trim();

    if (!title) {
        alert('请输入提示词标题');
        return;
    }

    const saveContent = content || currentPromptContent;
    if (!saveContent) {
        alert('请输入提示词内容');
        return;
    }

    fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            folder_id: folderId,
            title: title,
            content: saveContent,
            summary: summary,
            image_path: imageUrl
        })
    })
    .then(r => r.json())
    .then(data => {
        if (data.error) {
            alert(data.error);
        } else {
            hideSaveDialog();
            alert('保存成功！');
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
