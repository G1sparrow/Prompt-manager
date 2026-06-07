import io
import json
from PIL import Image, UnidentifiedImageError

EXIF_USER_COMMENT = 0x9286


def inspect_image(file_storage):
    data = file_storage.read()
    file_storage.seek(0)

    try:
        img = Image.open(io.BytesIO(data))

        # Try ComfyUI format first (JSON in 'prompt' key)
        prompt_json = img.info.get('prompt')
        if prompt_json:
            try:
                result = _parse_comfyui(prompt_json)
                if result:
                    return result
            except (json.JSONDecodeError, Exception):
                pass

        # Try SD-WebUI format (plain text Parameters string)
        raw = img.info.get('parameters') or img.info.get('Description')
        if raw:
            return _format_sd_result(raw, 'sd-webui')

        # Try EXIF UserComment (JPEG/WebP)
        exif = img.getexif()
        if exif:
            raw_bytes = exif.get(EXIF_USER_COMMENT)
            if raw_bytes:
                text = _decode_user_comment(raw_bytes)
                if text:
                    return _format_sd_result(text, 'sd-webui')

    except (UnidentifiedImageError, Exception):
        pass

    return None


def _decode_user_comment(data):
    if isinstance(data, bytes):
        header = data[:8]
        if header.startswith(b'ASCII'):
            return data[8:].decode('ascii', errors='replace').replace('\x00', '').strip()
        elif header.startswith(b'UNICODE'):
            return data[8:].decode('utf-16', errors='replace').replace('\x00', '').strip()
        else:
            return data.decode('utf-8', errors='replace').replace('\x00', '').strip()
    text = str(data).replace('\x00', '').strip()
    return text if text else None


def _format_sd_result(raw_text, source):
    parsed = _parse_sd_metadata(raw_text)
    return {
        'prompt': parsed['prompt'],
        'negative_prompt': parsed['negative_prompt'],
        'parameters': parsed['parameters'],
        'raw_metadata': raw_text,
        'source': source
    }


def _parse_comfyui(prompt_json_str):
    nodes = json.loads(prompt_json_str)
    positive_text = ''
    negative_text = ''
    params_parts = []

    def safe_text(val):
        return val if isinstance(val, str) else ''

    for node_id, node in nodes.items():
        ct = node.get('class_type', '')
        title = node.get('_meta', {}).get('title', '')
        inputs = node.get('inputs', {})

        # CLIPTextEncode nodes hold the prompts
        if ct == 'CLIPTextEncode':
            text = safe_text(inputs.get('text', ''))
            title_lower = title.lower()
            if 'negative' in title_lower:
                negative_text = text
            elif not positive_text:
                positive_text = text
            else:
                negative_text = text

        # KSampler / Sampler nodes hold generation parameters
        if ct in ('KSampler', 'KSamplerAdvanced', 'SamplerCustom'):
            parts = []
            for k in ('seed', 'steps', 'cfg', 'sampler_name', 'scheduler'):
                v = inputs.get(k)
                if v is not None:
                    parts.append(f'{k}: {v}')
            if parts:
                params_parts.append(f'{ct}: ' + ', '.join(parts))

    if not positive_text and not negative_text:
        return None

    params_str = ' | '.join(params_parts)
    return {
        'prompt': positive_text,
        'negative_prompt': negative_text,
        'parameters': params_str,
        'raw_metadata': prompt_json_str,
        'source': 'comfyui'
    }


def _parse_sd_metadata(raw):
    parts = raw.split("Steps: ", 1)
    prompt_part = parts[0].strip()
    params_part = "Steps: " + parts[1] if len(parts) > 1 else ""

    if "Negative prompt: " in prompt_part:
        splits = prompt_part.split("Negative prompt: ", 1)
        prompt = splits[0].strip()
        negative_prompt = splits[1].strip()
    else:
        prompt = prompt_part
        negative_prompt = ""

    return {
        'prompt': prompt,
        'negative_prompt': negative_prompt,
        'parameters': params_part.strip()
    }
