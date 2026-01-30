import os
import json
import struct
import re

# 設定
SAMPLES_DIR = os.path.join(os.path.dirname(__file__), '../tests/samples')
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '../tests/expected/raw-metadata')

if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

def read_png_chunks(filepath):
    """
    PNGファイルからテキスト系チャンクおよび特定のプライベートチャンクを抽出する
    """
    metadata = {}
    with open(filepath, 'rb') as f:
        # Signature check
        if f.read(8) != b'\x89PNG\r\n\x1a\n':
            return {}

        while True:
            # Read chunk length and type
            buf = f.read(8)
            if len(buf) < 8:
                break
            length, chunk_type_bytes = struct.unpack('>I4s', buf)
            chunk_type = chunk_type_bytes.decode('ascii', errors='ignore')
            
            # Read chunk data
            data = f.read(length)
            # Read CRC (skip)
            f.read(4)

            # Process specific chunks
            if chunk_type == 'tEXt':
                try:
                    parts = data.split(b'\x00', 1)
                    if len(parts) == 2:
                        key = parts[0].decode('latin-1')
                        val = parts[1].decode('latin-1')
                        metadata[key] = val
                except:
                    pass
            
            elif chunk_type == 'iTXt':
                try:
                    parts = data.split(b'\x00', 5)
                    if len(parts) >= 2:
                        key = parts[0].decode('utf-8', errors='ignore')
                        val = parts[-1].decode('utf-8', errors='ignore')
                        metadata[key] = val
                except:
                    pass

            # ComfyUIの独自チャンク？ ('comf')
            elif chunk_type == 'comf':
                try:
                    # キーワードなどがなく、そのままJSONが入っている可能性がある
                    # あるいはキーと値のペアか？
                    # とりあえず文字列としてデコードを試みる
                    decoded = data.decode('utf-8', errors='ignore')
                    
                    # 既に 'comf' キーがある場合は配列にするか、連番にする
                    if 'comf' in metadata:
                        if not isinstance(metadata['comf'], list):
                             metadata['comf'] = [metadata['comf']]
                        metadata['comf'].append(decoded)
                    else:
                        metadata['comf'] = decoded
                except:
                    pass

            if chunk_type == 'IEND':
                break
                
    return metadata

def read_webp_chunks(filepath):
    """
    WebPファイルからEXIF情報を抽出する
    """
    metadata = {}
    with open(filepath, 'rb') as f:
        # RIFF Header
        if f.read(4) != b'RIFF':
            return {}
        f.read(4) 
        if f.read(4) != b'WEBP':
            return {}

        while True:
            chunk_header = f.read(4)
            if len(chunk_header) < 4:
                break
            chunk_type = chunk_header.decode('ascii', errors='ignore')
            
            size_bytes = f.read(4)
            if len(size_bytes) < 4:
                break
            chunk_size = struct.unpack('<I', size_bytes)[0]
            
            data = f.read(chunk_size)
            
            if chunk_size % 2 == 1:
                f.read(1)

            if chunk_type == 'EXIF':
                try:
                    # ASCII部分のみ抽出してダンプ
                    # 制御文字を除去
                    decoded = ''.join([c if 32 <= ord(c) < 127 else ' ' for c in data.decode('latin-1', errors='ignore')])
                    # 連続するスペースを除去
                    decoded = re.sub(r'\s+', ' ', decoded).strip()
                    metadata['exif_dump'] = decoded
                except:
                    pass
            
            elif chunk_type == 'XMP ':
                try:
                    metadata['xmp'] = data.decode('utf-8', errors='ignore')
                except:
                    pass

    return metadata

def extract_metadata(filename):
    filepath = os.path.join(SAMPLES_DIR, filename)
    ext = os.path.splitext(filename)[1].lower()
    
    metadata = {}
    if ext == '.png':
        metadata = read_png_chunks(filepath)
    elif ext == '.webp':
        metadata = read_webp_chunks(filepath)
    else:
        return

    if not metadata:
        print(f"[SKIP] No metadata found in: {filename}")
        return

    output_filename = filename.replace('.', '_') + '_raw.json'
    output_path = os.path.join(OUTPUT_DIR, output_filename)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    
    print(f"[OK] Processed: {filename} -> {output_filename}")

if __name__ == '__main__':
    print(f"Scanning directory: {SAMPLES_DIR}")
    if os.path.exists(SAMPLES_DIR):
        files = os.listdir(SAMPLES_DIR)
        for filename in files:
            extract_metadata(filename)
    print("Done.")