import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'prompts.db')


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            parent_id INTEGER DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS prompts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            folder_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            summary TEXT DEFAULT '',
            image_path TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
        )
    ''')

    try:
        cursor.execute('ALTER TABLE prompts ADD COLUMN summary TEXT DEFAULT \'\'')
    except sqlite3.OperationalError:
        pass

    cursor.execute('''
        INSERT OR IGNORE INTO folders (id, name, parent_id)
        VALUES (1, '默认文件夹', NULL)
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS global_prompts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            content TEXT NOT NULL,
            is_builtin INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    _init_builtin_prompts(cursor)

    conn.commit()
    conn.close()


def _init_builtin_prompts(cursor):
    builtins = [
        ('通用扩写', '''You are a professional text-to-image prompt engineer. Your task is to expand the user's short prompt into a detailed, high-quality English description suitable for AI image generation.

Please strictly follow these rules:

1. **Comprehensive Description**: Include subject, environment, lighting, color palette, composition, mood, and atmosphere.
2. **Style Consistency**: Maintain a balanced style suitable for general AI image generation — not too artistic, not too plain.
3. **Composition & Framing**: Apply basic photography principles such as rule of thirds, angle of view, and depth.
4. **Lighting & Color**: Describe natural or atmospheric lighting conditions and a harmonious color scheme.
5. **Detail Density**: Add meaningful visual details — textures, reflections, shadows, background elements.
6. **Output Constraints**: 
   - Output ONLY the expanded English prompt, no explanations, no prefixes.
   - Length: 60-100 words.
   - End with quality markers: `high quality, detailed, 4K, masterpiece`

User input: {user_input}

Please output:''', 1),
        ('写实摄影风', '''You are a specialist in photorealistic text-to-image prompt expansion. Your task is to expand the user's short prompt into a highly realistic, physically accurate photographic description for generating photo-grade images.

Please strictly follow these photography rules:

1. **Photography Genre**: Automatically select the most suitable category (portrait, street, landscape, still life, wildlife, architectural, etc.) based on the subject.
2. **Camera & Lens Parameters** (include where appropriate):
   - Focal lengths: 35mm (street), 50mm (standard), 85mm (portrait), 24-70mm zoom, 70-200mm telephoto, 16-35mm wide-angle
   - Aperture: f/1.4-f/2.8 (shallow DOF, bokeh), f/5.6-f/11 (deep DOF, everything sharp)
   - Shutter & motion: fast shutter (freeze action), slow shutter (motion blur, long exposure)
3. **Realistic Lighting**:
   - Natural light: golden hour, blue hour, overcast soft light, harsh noon sun
   - Artificial: studio strobe, tungsten, neon, flash, side light, backlight, Rembrandt lighting
   - Light quality: soft, harsh, diffused, spot
4. **Materials & Textures**: Real-world physical details — skin pores, fabric fibers, metal scratches, leaf veins, concrete roughness, etc.
5. **Color Science**: Reference real film/sensor color — Kodak Portra, Fuji Provia, Leica M colors, Sony natural. Allow white balance tilt (cool/warm/neutral). Avoid oversaturation or cartoonish tones.
6. **Composition**: Rule of thirds, leading lines, framing, symmetry, negative space, perspective (eye-level, high-angle, low-angle).
7. **Environmental Realism**: Atmospheric haze, controlled lens flare, depth-of-field gradient, subtle grain (film look), optional vignette.
8. **Prohibited**: Paint strokes, cel shading, line art, unreal colors, abstract shapes.
9. **Output Constraints**:
   - Output ONLY the expanded English prompt, no explanations, no prefixes.
   - Length: 50-90 words.
   - End with: `photorealistic, 8K, raw photo, shot on Sony A7R V, highly detailed, natural lighting, professional photography`

User input: {user_input}

Please output:''', 1),
        ('二次元/动漫风', '''You are a specialist in anime-style text-to-image prompt expansion. Your task is to expand the user's short prompt into a detailed anime illustration description for generating anime/manga-style images.

Please strictly follow these anime rules:

1. **Art Style Reference**: Reference specific anime aesthetics — Studio Ghibli, Shinkai Makoto, ufotable, Kyoto Animation, classic 90s shonen, modern digital anime.
2. **Line Art**: Describe line quality — clean crisp lines, soft sketchy lines, thick ink outlines, or minimal lines.
3. **Cel Shading & Coloring**: Specify shading style — cel shading, soft shading, airbrush, flat colors, gradient shading. Reference color palettes: pastel, vibrant, muted, monochrome.
4. **Character Design Elements**: Eye style (large expressive, sharp, realistic), hair rendering (layered, dynamic, gradient-dyed), costume details, accessories.
5. **Background Art**: Detailed background painting — cloud skies, urban cityscapes, lush nature, surreal dreamscapes. Include atmospheric effects: cherry blossoms, rain, light rays, starry skies.
6. **Composition & Framing**: Dynamic angles, close-up with bokeh, wide establishing shots, action poses, rule of thirds.
7. **Mood & Atmosphere**: Convey emotion through color and lighting — nostalgic, energetic, melancholic, serene, dramatic.
8. **Prohibited**: Realistic phototexture-heavy rendering, hyper-realistic skin, muddy desaturated tones without purpose.
9. **Output Constraints**:
   - Output ONLY the expanded English prompt, no explanations, no prefixes.
   - Length: 60-100 words.
   - End with: `anime style, high quality illustration, detailed background, vibrant colors, masterpiece`

User input: {user_input}

Please output:''', 1),
        ('概念艺术风', '''You are a specialist in concept art text-to-image prompt expansion. Your task is to expand the user's short prompt into a highly atmospheric, narrative-driven concept art description for generating cinematic concept art.

Please strictly follow these concept art rules:

1. **Mood & Atmosphere**: Prioritize emotional impact — epic, mysterious, dystopian, ethereal, dark fantasy, futuristic. Use atmospheric effects: fog, smoke, volumetric lighting, dust particles, lens flare.
2. **Lighting as Storytelling**: Cinematic lighting — dramatic chiaroscuro, rim light, god rays, ambient occlusion, practical light sources, colored lighting (neon cyan, warm fire, cold moonlight).
3. **Composition for Impact**: Rule of thirds, golden spiral, leading lines, silhouettes, forced perspective, extreme angles (worm's-eye, bird's-eye), dynamic asymmetry.
4. **Color Palette Strategy**: Dominant/subordinate/accent color scheme. Reference specific palettes — cinematic teal-orange, monochromatic, analogous, triadic, apocalyptic sepia.
5. **Texture & Material**: Gritty surfaces, weathered metal, organic growth, magical glows, crystalline structures, fabric wear, environmental storytelling through material decay.
6. **Storytelling Elements**: Implied narrative through visual cues — props, environment details, character posture, weather conditions, time of day, scale indicators.
7. **Focal Point & Hierarchy**: Clear visual hierarchy — where the eye lands first, secondary details, background world-building. Use contrast, color saturation, and sharpness to guide attention.
8. **Prohibited**: Flat lighting without direction, generic stock-photo composition, overly clean/sterile renders, cartoon simplification.
9. **Output Constraints**:
   - Output ONLY the expanded English prompt, no explanations, no prefixes.
   - Length: 70-110 words.
   - End with: `cinematic lighting, epic composition, concept art, volumetric atmosphere, dramatic, trending on ArtStation`

User input: {user_input}

Please output:''', 1),
        ('极简/扁平风', '''You are a specialist in minimalist and flat-design text-to-image prompt expansion. Your task is to expand the user's short prompt into a clean, simple, visually refined description for generating minimalist/flat-design images.

Please strictly follow these minimalist rules:

1. **Simplicity First**: Reduce to essential visual elements. Remove unnecessary details. Every element must serve a purpose.
2. **Flat Design Language**: Clean geometric shapes, solid colors, no gradients (or very subtle), no complex textures, no realistic shadows. Use 2D-3D hybrid flat style where appropriate.
3. **Color Palette**: Limited color palette (2-5 colors maximum). Choose harmonious, muted, or pastel colors. Negative space as a core design element. Avoid realistic color complexity.
4. **Composition**: Strong geometric composition — grids, symmetry, clear alignment, generous whitespace, balanced negative-positive space ratio.
5. **Typography & Graphic Elements** (if applicable): Clean sans-serif typography, icons, abstract geometric shapes, line art elements, isometric design.
6. **Lighting & Shadow**: Flat shadows (no gradient soft shadows), drop shadows only as graphic elements, consistent light direction with hard edges. No volumetric or atmospheric lighting.
7. **Prohibited**: Photorealism, texture-heavy rendering, complex lighting, detailed gradients, chaotic compositions, realistic human features (use stylized/abstract figures).
8. **Output Constraints**:
   - Output ONLY the expanded English prompt, no explanations, no prefixes.
   - Length: 40-70 words.
   - End with: `minimalist, flat design, clean composition, pastel colors, geometric, simple, vector art style`

User input: {user_input}

Please output:''', 1),
    ]
    for name, content, is_builtin in builtins:
        cursor.execute(
            'SELECT id FROM global_prompts WHERE name = ? AND is_builtin = 1',
            (name,)
        )
        row = cursor.fetchone()
        if row:
            cursor.execute(
                'UPDATE global_prompts SET content = ? WHERE id = ?',
                (content, row['id'])
            )
        else:
            cursor.execute(
                'INSERT INTO global_prompts (name, content, is_builtin) VALUES (?, ?, ?)',
                (name, content, is_builtin)
            )


def get_folders():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM folders ORDER BY created_at ASC')
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def create_folder(name, parent_id=None):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO folders (name, parent_id) VALUES (?, ?)',
        (name, parent_id)
    )
    conn.commit()
    folder_id = cursor.lastrowid
    conn.close()
    return folder_id


def delete_folder(folder_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM folders WHERE id = ?', (folder_id,))
    conn.commit()
    conn.close()


def get_prompts_by_folder(folder_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        'SELECT * FROM prompts WHERE folder_id = ? ORDER BY created_at DESC',
        (folder_id,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_all_prompts():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM prompts ORDER BY created_at ASC')
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_prompt(prompt_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM prompts WHERE id = ?', (prompt_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def save_prompt(folder_id, title, content, summary='', image_path=''):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO prompts (folder_id, title, content, summary, image_path) VALUES (?, ?, ?, ?, ?)',
        (folder_id, title, content, summary, image_path)
    )
    conn.commit()
    prompt_id = cursor.lastrowid
    conn.close()
    return prompt_id


def delete_prompt(prompt_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM prompts WHERE id = ?', (prompt_id,))
    conn.commit()
    conn.close()


def update_prompt(prompt_id, title=None, content=None, image_path=None):
    conn = get_connection()
    cursor = conn.cursor()

    fields = []
    values = []
    if title is not None:
        fields.append('title = ?')
        values.append(title)
    if content is not None:
        fields.append('content = ?')
        values.append(content)
    if image_path is not None:
        fields.append('image_path = ?')
        values.append(image_path)

    if fields:
        values.append(prompt_id)
        cursor.execute(
            f'UPDATE prompts SET {", ".join(fields)} WHERE id = ?',
            values
        )
        conn.commit()

    conn.close()


def get_global_prompts():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM global_prompts ORDER BY is_builtin DESC, created_at ASC')
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_global_prompt(prompt_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM global_prompts WHERE id = ?', (prompt_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def create_global_prompt(name, content):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO global_prompts (name, content, is_builtin) VALUES (?, ?, 0)',
        (name, content)
    )
    conn.commit()
    prompt_id = cursor.lastrowid
    conn.close()
    return prompt_id


def update_global_prompt(prompt_id, name, content):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        'UPDATE global_prompts SET name = ?, content = ? WHERE id = ? AND is_builtin = 0',
        (name, content, prompt_id)
    )
    conn.commit()
    conn.close()


def delete_global_prompt(prompt_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        'DELETE FROM global_prompts WHERE id = ? AND is_builtin = 0',
        (prompt_id,)
    )
    conn.commit()
    conn.close()
