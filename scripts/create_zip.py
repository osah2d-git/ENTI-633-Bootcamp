import zipfile
import os
import sys

def make_zip(out_path):
    exclude_dirs = {'node_modules', 'dist', '.git', '.cache'}
    with zipfile.ZipFile(out_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk('.'):
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            for f in files:
                if f.endswith('.zip') or f.endswith('.log'):
                    continue
                file_path = os.path.join(root, f)
                arcname = os.path.relpath(file_path, '.')
                zipf.write(file_path, arcname)

if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else '/tmp/retail-sales-commentary.zip'
    make_zip(target)
    print("DONE")
