import json
import os

CONFIG_PATH = os.path.join(os.path.dirname(__file__), 'config.json')

PRESET_MODELS = [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-3.5-turbo',
    'claude-3-5-sonnet-20241022',
    'claude-3-opus-20240229',
    'claude-3-haiku-20240307',
    'deepseek-chat',
    'deepseek-reasoner',
    'qwen-plus',
    'qwen-turbo',
    'glm-4-plus',
    'moonshot-v1-8k',
]

DEFAULT_CONFIG = {
    'llm': {
        'base_url': 'https://api.openai.com/v1',
        'api_key': '',
        'model': 'gpt-3.5-turbo'
    },
    'baidu_translate': {
        'appid': '',
        'secret_key': ''
    }
}


def load_config(with_models=False):
    if not os.path.exists(CONFIG_PATH):
        save_config(DEFAULT_CONFIG)
        cfg = DEFAULT_CONFIG.copy()
    else:
        with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
            try:
                cfg = json.load(f)
                for key in DEFAULT_CONFIG:
                    if key not in cfg:
                        cfg[key] = DEFAULT_CONFIG[key].copy()
                    elif isinstance(DEFAULT_CONFIG[key], dict):
                        for subkey in DEFAULT_CONFIG[key]:
                            if subkey not in cfg[key]:
                                cfg[key][subkey] = DEFAULT_CONFIG[key][subkey]
            except json.JSONDecodeError:
                cfg = DEFAULT_CONFIG.copy()

    if with_models:
        cfg['preset_models'] = PRESET_MODELS
    return cfg


def save_config(cfg):
    with open(CONFIG_PATH, 'w', encoding='utf-8') as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
