import hashlib
import random
import requests
from config import load_config
from database import get_global_prompt


def expand_prompt(prompt_text, global_prompt_id=None):
    cfg = load_config()
    llm_cfg = cfg['llm']

    if not llm_cfg['api_key']:
        return {'error': '请先在设置中配置LLM API Key'}

    system_content = None
    if global_prompt_id:
        gp = get_global_prompt(global_prompt_id)
        if gp:
            system_content = gp['content']

    if not system_content:
        system_content = 'You are a prompt engineer. Expand the following text into a detailed, high-quality English prompt for text-to-image generation. Include details about style, lighting, composition, colors, and atmosphere. Return only the expanded prompt without any explanation.'
    else:
        system_content = system_content.replace('{user_input}', prompt_text)

    base_url = llm_cfg['base_url'].rstrip('/')
    model = llm_cfg['model']

    headers = {
        'Authorization': f'Bearer {llm_cfg["api_key"]}',
        'Content-Type': 'application/json'
    }

    payload = {
        'model': model,
        'messages': [
            {'role': 'system', 'content': system_content},
            {'role': 'user', 'content': prompt_text}
        ],
        'temperature': 0.7,
        'max_tokens': 1000
    }

    try:
        resp = requests.post(
            f'{base_url}/chat/completions',
            headers=headers,
            json=payload,
            timeout=60
        )
        resp.raise_for_status()
        data = resp.json()
        content = data['choices'][0]['message']['content'].strip()
        return {'result': content}
    except requests.exceptions.Timeout:
        return {'error': '请求超时，请检查网络连接'}
    except requests.exceptions.ConnectionError:
        return {'error': '无法连接到API服务器，请检查配置的API地址'}
    except requests.exceptions.HTTPError as e:
        return {'error': f'HTTP错误: {e.response.status_code} - {e.response.text[:200]}'}
    except Exception as e:
        return {'error': f'扩写失败: {str(e)}'}


def translate_prompt(text, target_lang):
    cfg = load_config()
    baidu_cfg = cfg['baidu_translate']

    if not baidu_cfg['appid'] or not baidu_cfg['secret_key']:
        return {'error': '请先在设置中配置百度翻译APP ID和密钥'}

    appid = baidu_cfg['appid']
    secret_key = baidu_cfg['secret_key']

    salt = str(random.randint(10000, 99999))
    sign_str = appid + text + salt + secret_key
    sign = hashlib.md5(sign_str.encode('utf-8')).hexdigest()

    lang_map = {
        'zh': 'zh',
        'en': 'en',
        'ja': 'jp',
        'ko': 'kor',
        'fr': 'fra',
        'de': 'de',
        'ru': 'ru',
        'es': 'spa'
    }

    to = lang_map.get(target_lang, target_lang)

    params = {
        'q': text,
        'from': 'auto',
        'to': to,
        'appid': appid,
        'salt': salt,
        'sign': sign
    }

    try:
        resp = requests.post(
            'https://fanyi-api.baidu.com/api/trans/vip/translate',
            params=params,
            timeout=15
        )
        resp.raise_for_status()
        data = resp.json()

        if 'error_code' in data and data['error_code'] != '0':
            error_msg = {
                '52001': '请求超时',
                '52002': '系统错误',
                '52003': '未授权用户（请检查APP ID）',
                '54000': '必填参数为空',
                '54001': '签名错误',
                '54003': '访问频率受限',
                '54005': '请求长度超限',
                '58000': '客户端IP非法',
                '58001': '译文语言方向不支持'
            }
            code = data['error_code']
            return {'error': f'百度翻译错误({code}): {error_msg.get(code, "未知错误")}'}

        translations = data.get('trans_result', [])
        result = '\n'.join([item['dst'] for item in translations])
        return {'result': result}

    except requests.exceptions.Timeout:
        return {'error': '翻译请求超时'}
    except requests.exceptions.ConnectionError:
        return {'error': '无法连接到百度翻译服务'}
    except Exception as e:
        return {'error': f'翻译失败: {str(e)}'}
