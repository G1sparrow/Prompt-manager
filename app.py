import os
import shutil
import uuid
from flask import Flask, jsonify, request, render_template
from database import init_db, get_folders, create_folder, delete_folder, \
    get_all_prompts, get_prompts_by_folder, get_prompt, save_prompt, \
    delete_prompt, update_prompt, \
    get_global_prompts, get_global_prompt, create_global_prompt, \
    update_global_prompt, delete_global_prompt
from config import load_config, save_config
from api_handler import expand_prompt, translate_prompt

app = Flask(__name__)
GENERATED_DIR = os.path.join(os.path.dirname(__file__), 'static', 'generated')


def _normalize_image_path(image_path):
    if not image_path:
        return ''
    path = image_path.strip().strip('"\'')
    if not path:
        return ''
    if path.startswith('/') or path.startswith('http://') or path.startswith('https://'):
        return path
    if os.path.exists(path):
        ext = os.path.splitext(path)[1] or '.png'
        filename = f'img_{uuid.uuid4().hex[:12]}{ext}'
        os.makedirs(GENERATED_DIR, exist_ok=True)
        try:
            shutil.copy2(path, os.path.join(GENERATED_DIR, filename))
            return f'/static/generated/{filename}'
        except Exception:
            return path
    return path


def _normalize_prompt(p):
    if isinstance(p, dict) and p.get('image_path'):
        p['image_path'] = _normalize_image_path(p['image_path'])
    return p


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/config', methods=['GET', 'POST'])
def api_config():
    if request.method == 'GET':
        return jsonify(load_config(with_models=True))

    cfg = request.get_json()
    if not cfg:
        return jsonify({'error': '无效的配置数据'}), 400

    try:
        save_config(cfg)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/expand', methods=['POST'])
def api_expand():
    data = request.get_json()
    if not data or not data.get('prompt', '').strip():
        return jsonify({'error': '请输入提示词'}), 400

    result = expand_prompt(
        data['prompt'].strip(),
        global_prompt_id=data.get('global_prompt_id')
    )
    if 'error' in result:
        return jsonify(result), 400
    return jsonify(result)


@app.route('/api/translate', methods=['POST'])
def api_translate():
    data = request.get_json()
    if not data or not data.get('text', '').strip():
        return jsonify({'error': '请输入翻译文本'}), 400
    if not data.get('target_lang'):
        return jsonify({'error': '请选择目标语言'}), 400

    result = translate_prompt(data['text'].strip(), data['target_lang'])
    if 'error' in result:
        return jsonify(result), 400
    return jsonify(result)


@app.route('/api/folders', methods=['GET', 'POST'])
def api_folders():
    if request.method == 'GET':
        return jsonify(get_folders())

    data = request.get_json()
    if not data or not data.get('name', '').strip():
        return jsonify({'error': '请输入文件夹名称'}), 400

    try:
        folder_id = create_folder(data['name'].strip(), data.get('parent_id'))
        return jsonify({'id': folder_id, 'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/folders/<int:folder_id>', methods=['DELETE'])
def api_delete_folder(folder_id):
    try:
        delete_folder(folder_id)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/folders/<int:folder_id>/prompts', methods=['GET'])
def api_folder_prompts(folder_id):
    prompts = get_prompts_by_folder(folder_id)
    return jsonify([_normalize_prompt(p) for p in prompts])


@app.route('/api/prompts', methods=['POST'])
def api_save_prompt():
    data = request.get_json()
    if not data or not data.get('title', '').strip():
        return jsonify({'error': '请输入提示词标题'}), 400
    if not data.get('content', '').strip():
        return jsonify({'error': '提示词内容不能为空'}), 400

    try:
        image_path = _normalize_image_path(data.get('image_path', ''))
        prompt_id = save_prompt(
            folder_id=data['folder_id'],
            title=data['title'].strip(),
            content=data['content'].strip(),
            summary=data.get('summary', '').strip(),
            image_path=image_path
        )
        return jsonify({'id': prompt_id, 'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/prompts/<int:prompt_id>', methods=['GET', 'DELETE'])
def api_prompt(prompt_id):
    if request.method == 'GET':
        prompt = get_prompt(prompt_id)
        if not prompt:
            return jsonify({'error': '提示词不存在'}), 404
        return jsonify(_normalize_prompt(prompt))

    try:
        delete_prompt(prompt_id)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/global-prompts', methods=['GET', 'POST'])
def api_global_prompts():
    if request.method == 'GET':
        return jsonify(get_global_prompts())

    data = request.get_json()
    if not data or not data.get('name', '').strip():
        return jsonify({'error': '请输入预设名称'}), 400
    if not data.get('content', '').strip():
        return jsonify({'error': '预设内容不能为空'}), 400

    try:
        prompt_id = create_global_prompt(data['name'].strip(), data['content'].strip())
        return jsonify({'id': prompt_id, 'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/global-prompts/<int:prompt_id>', methods=['GET', 'PUT', 'DELETE'])
def api_global_prompt_detail(prompt_id):
    if request.method == 'GET':
        gp = get_global_prompt(prompt_id)
        if not gp:
            return jsonify({'error': '预设不存在'}), 404
        return jsonify(gp)

    if request.method == 'PUT':
        data = request.get_json()
        if not data or not data.get('name', '').strip():
            return jsonify({'error': '请输入预设名称'}), 400
        if not data.get('content', '').strip():
            return jsonify({'error': '预设内容不能为空'}), 400

        try:
            update_global_prompt(prompt_id, data['name'].strip(), data['content'].strip())
            return jsonify({'success': True})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    if request.method == 'DELETE':
        try:
            delete_global_prompt(prompt_id)
            return jsonify({'success': True})
        except Exception as e:
            return jsonify({'error': str(e)}), 500


def _migrate_existing_images():
    prompts = get_all_prompts()
    seen = set()
    for p in prompts:
        old = p['image_path']
        if not old:
            continue
        if old.startswith('/') or old.startswith('http://') or old.startswith('https://'):
            continue
        if old in seen:
            continue
        seen.add(old)
        new_path = _normalize_image_path(old)
        if new_path != old:
            update_prompt(p['id'], image_path=new_path)


if __name__ == '__main__':
    init_db()
    _migrate_existing_images()
    app.run(debug=True, port=5000)
