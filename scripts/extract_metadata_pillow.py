
import os
import json
from PIL import Image

# 設定
SAMPLES_DIR = os.path.join(os.path.dirname(__file__), '../tests/fixtures')
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '../tests/expected/raw-metadata')

# 出力ディレクトリの作成
if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

def extract_metadata(filename):
    filepath = os.path.join(SAMPLES_DIR, filename)
    
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ['.png', '.webp']:
        return

    try:
        with Image.open(filepath) as img:
            # メタデータを確実に読み込むために load() を呼ぶ
            img.load()
            metadata = {}

            # PNGの場合
            if ext == '.png':
                # info の中身をチェック
                for k, v in img.info.items():
                    # print(f"DEBUG: {filename} info key: {k}") # デバッグ用
                    if isinstance(v, (str, int, float)):
                         metadata[k] = v
                
                # text 属性をチェック
                if hasattr(img, 'text'):
                    for k, v in img.text.items():
                        # print(f"DEBUG: {filename} text key: {k}") # デバッグ用
                        metadata[k] = v

            # WebPの場合
            elif ext == '.webp':
                for k, v in img.info.items():
                    if k != 'exif' and isinstance(v, (str, int, float)):
                        metadata[k] = v
                
                if 'exif' in img.info:
                    exif = img.getexif()
                    if exif:
                        exif_data = {}
                        for tag_id, value in exif.items():
                             exif_data[str(tag_id)] = str(value)
                        metadata['exif_tags'] = exif_data

            if not metadata:
                print(f"[SKIP] No metadata found in: {filename}")
                # 空でもデバッグのためにファイルを出力してみることはしませんが、
                # もし info に何かキーがあればそれは表示したい
                if img.info:
                    print(f"  -> keys in img.info: {list(img.info.keys())}")
                if hasattr(img, 'text') and img.text:
                     print(f"  -> keys in img.text: {list(img.text.keys())}")
                return

            # 出力ファイル名
            output_filename = filename.replace('.', '_') + '_raw.json'
            output_path = os.path.join(OUTPUT_DIR, output_filename)

            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2, ensure_ascii=False)
            
            print(f"[OK] Processed: {filename} -> {output_filename}")

    except Exception as e:
        print(f"[ERROR] Failed to process {filename}: {e}")

if __name__ == '__main__':
    print(f"Scanning directory: {SAMPLES_DIR}")
    if not os.path.exists(SAMPLES_DIR):
        print(f"[ERROR] Samples directory not found: {SAMPLES_DIR}")
    else:
        files = os.listdir(SAMPLES_DIR)
        for filename in files:
            extract_metadata(filename)
    print("Done.")
